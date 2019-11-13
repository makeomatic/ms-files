const Promise = require('bluebird');
const { Microfleet, ConnectorsTypes } = require('@microfleet/core');
const noop = require('lodash/noop');
const merge = require('lodash/merge');
const fsort = require('redis-filtered-sort');
const LockManager = require('dlock');

// constants
const { HttpStatusError } = require('common-errors');
const { WEBHOOK_RESOURCE_ID } = require('./constant');
const StorageProviders = require('./providers');
const conf = require('./config');
const DatabaseManager = require('./services/db-manager');
const RedisManager = require('./services/redis');
const CouchDBManager = require('./services/couchdb');

/**
 * @class Files
 */
class Files extends Microfleet {
  /**
   * class Constructor, initializes configuration
   * and internal providers
   */
  constructor(opts = {}) {
    super(merge({}, Files.defaultOpts, opts));
    const { config } = this;

    /**
     * Determines whether we have couchdb enabled
     * @type {boolean}
     */
    this.couchEnabled = config.plugins.includes('couchdb');

    /**
     * Invoke this method to start post-processing of all pending files
     * @return {Promise}
     */
    this.postProcess = require('./post-process');

    // extend with storage providers
    StorageProviders(this);

    // database abstraction
    this.dbManager = new DatabaseManager(this);

    // 2 different plugin types
    if (config.plugins.includes('redisCluster')) {
      this.redisType = 'redisCluster';
    } else if (config.plugins.includes('redisSentinel')) {
      this.redisType = 'redisSentinel';
    } else {
      throw new Error('must include redis family plugins');
    }

    // init scripts
    this.on(`plugin:connect:${this.redisType}`, (redis) => {
      fsort.attach(redis, 'fsort');

      this.log.debug('enabling lock manager');
      this.dlock = new LockManager({
        ...config.lockManager,
        // main connection
        client: redis,
        // second connection
        pubsub: redis.duplicate(),
        log: this.log,
      });

      this.dbManager.addStorage(new RedisManager(redis, config), 'redis');
    });

    this.on('plugin:connect:couchdb', (couchdb) => {
      this.dbManager.addStorage(new CouchDBManager(couchdb, config), 'couchdb');
    });

    // add migration connector
    if (config.migrations.enabled === true) {
      this.addConnector(ConnectorsTypes.migration, () => (
        this.migrate('redis', `${__dirname}/migrations`)
      ), 'redis-migration');
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
   * @return {Promise}
   */
  close() {
    return Promise.join(
      super.close(),
      this.dlock.pubsub.disconnect(),
      process.env.WEBHOOK_TERMINATE ? this.stopWebhook() : noop
    );
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
    const { prefix } = this.config.router.routes;
    const route = `${prefix}.finish`;

    try {
      await this.router.dispatch(route, {
        headers: {},
        query: {},
        // payload
        params: {
          filename: message.attributes.objectId,
          resourceId: message.attributes.resource,
          action: message.attributes.eventType,
        },
        transport: 'amqp',
        method: 'amqp',
      });
    } catch (err) {
      this.log.warn({ route, args: message.attributes, err }, 'failed notification');
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
    this.log.debug('started connecting');
    await super.connect();
    await this.initWebhook();
    await Promise.mapSeries(this.providers, (provider) => {
      if (!provider.config.bucket.channel.pubsub) return null;
      return provider.subscribe(this.handleUploadNotification.bind(this));
    });
  }
}

/**
 * Default options for the service
 * @type {Object}
 */
Files.defaultOpts = conf.get('/', { env: process.env.NODE_ENV });

module.exports = Files;
