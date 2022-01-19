const Promise = require('bluebird');
const { Microfleet, ConnectorsTypes } = require('@microfleet/core');
const noop = require('lodash/noop');
const merge = require('lodash/merge');
const fsort = require('redis-filtered-sort');
const LockManager = require('dlock');
const RedisCluster = require('ioredis').Cluster;

// constants
const { HttpStatusError } = require('common-errors');
const { WEBHOOK_RESOURCE_ID } = require('./constant');
const StorageProviders = require('./providers');
const conf = require('./config');

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
     * Invoke this method to start post-processing of all pending files
     * @return {Promise}
     */
    this.postProcess = require('./post-process');

    // extend with storage providers
    StorageProviders(this);

    // 2 different plugin types
    let redisDuplicate;
    if (config.plugins.includes('redis-cluster')) {
      this.redisType = 'redisCluster';
      redisDuplicate = () => new RedisCluster(config.redis.hosts, config.redis.options);
    } else if (config.plugins.includes('redis-sentinel')) {
      this.redisType = 'redisSentinel';
      redisDuplicate = (redis) => redis.duplicate();
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
        pubsub: redisDuplicate(redis),
        log: this.log,
      });
    });

    // add migration connector
    if (config.migrations.enabled === true) {
      this.addConnector(ConnectorsTypes.migration, () => (
        this.migrate('redis', `${__dirname}/migrations`)
      ));
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
      await this.router.dispatch({
        route,
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
      // @todo
      if (provider.config.name !== 'gce') return null;
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
