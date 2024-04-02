const Promise = require('bluebird');
const { Microfleet, ConnectorsTypes } = require('@microfleet/core');
const noop = require('lodash/noop');
const fsort = require('redis-filtered-sort');
const { glob } = require('glob');
const deepmerge = require('@fastify/deepmerge')({
  mergeArray(options) {
    const { clone } = options;
    return function replaceByClonedSource(_, source) {
      return clone(source);
    };
  },
});

// constants
const { HttpStatusError } = require('common-errors');
const { WEBHOOK_RESOURCE_ID, TRANSPORT_NAME_GCE } = require('./constant');
const StorageProviders = require('./providers');
const { initStore } = require('./config');

/**
 * @class Files
 */
class Files extends Microfleet {
  /**
   * class Constructor, initializes configuration
   * and internal providers
   */
  constructor(opts) {
    super(opts);

    /**
     * Invoke this method to start post-processing of all pending files
     * @return {Promise}
     */
    this.postProcess = require('./post-process');
  }

  async register() {
    await super.register();

    const { config } = this;

    // extend with storage providers
    StorageProviders(this);

    // init scripts
    this.on(`plugin:connect:${this.redisType}`, (redis) => {
      fsort.attach(redis, 'fsort');
    });

    // add migration connector
    if (config.migrations.enabled === true) {
      this.addConnector(ConnectorsTypes.migration, async () => {
        const files = await glob('*/*.{js,ts}', {
          cwd: `${__dirname}/migrations`,
          absolute: true,
          ignore: ['*.d.ts', '**/*.d.ts', '*.d.mts', '**/*.d.mts', '*.d.cts', '**/*.d.cts'],
        })
          .then((migrationScripts) => Promise.all(migrationScripts.map(async (script) => {
            const mod = await import(script);

            this.log.info({ mod }, 'loaded %s', script);

            return mod.default || mod;
          })));

        await this.migrate('redis', files);
      });
    }
  }

  /**
   * Init's webhook
   */
  initWebhook() {
    this.log.debug('initializing webhook');
    const { redis } = this;
    return Promise
      .map(this.providers, (provider, idx) => {
        const hookId = `${WEBHOOK_RESOURCE_ID}_${idx}`;
        return Promise
          .bind(provider)
          .then(() => process.env[hookId] || redis.get(hookId))
          .then(provider.setupChannel)
          .then((resourceId) => resourceId && redis.set(hookId, resourceId));
      });
  }

  /**
   * Terminate notifications
   */
  stopWebhook() {
    return Promise
      .map(this.providers, (provider, idx) => {
        const hookId = `${WEBHOOK_RESOURCE_ID}_${idx}`;
        return provider
          .stopChannel()
          .tap((data) => this.log.info('stopped channel', data))
          .then(() => this.redis.del(hookId))
          .catch((e) => this.log.error({ err: e }, 'failed to stop channel'));
      });
  }

  /**
   * Overload close and make sure pubsub is stopped
   * @return {Promise<void>}
   */
  async close() {
    await Promise.all([
      super.close(),
      process.env.WEBHOOK_TERMINATE ? this.stopWebhook() : noop,
    ]);
  }

  /**
   * Handles upload notification
   * https://github.com/GoogleCloudPlatform/google-cloud-node/blob/pubsub-0.9.0/packages/pubsub/src/subscription.js#L344
   * @param {String} ackId
   * @param {String} id
   * @param {Mixed} data
   * @param {Mixed} attributes
   * @return {Promise}
   */
  async handleUploadNotification(message) {
    this.log.debug({ message }, 'upload notification');

    const params = {
      filename: message.attributes.objectId,
      resourceId: message.attributes.resource,
      action: message.attributes.eventType,
    };

    try {
      await this.dispatch('finish', { params });
    } catch (err) {
      this.log.warn({ args: message.attributes, err }, 'failed notification');
      if (!(err instanceof HttpStatusError)) {
        message.nack(err);
        return;
      }
    }

    message.ack();
  }

  // log failed notification
  logWarn(route, args, e) {
    this.log.warn({ route, args, err: e }, 'failed notification');
  }

  /**
   * Overload connect and make sure we have access to bucket
   * @return {Promise}
   */
  async connect() {
    await super.connect();
    await this.initWebhook();
    await Promise.mapSeries(this.providers, (provider) => {
      // @todo
      if (provider.config.name !== TRANSPORT_NAME_GCE) return null;
      if (!provider.config.bucket.channel.pubsub) return null;
      return provider.subscribe(this.handleUploadNotification.bind(this));
    });
  }
}

async function initFiles(opts = {}) {
  const store = await initStore({ env: process.env.NODE_ENV });
  const files = new Files(deepmerge(store.get('/'), opts));
  return files;
}

exports = module.exports = initFiles;
exports.Files = Files;
exports.default = initFiles;
