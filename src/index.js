const Promise = require('bluebird');
const Mservice = require('mservice');
const ld = require('lodash');
const fsort = require('redis-filtered-sort');
const LockManager = require('dlock');
const RedisCluster = require('ioredis').Cluster;
const StorageProviders = require('./providers');

// constants
const { HttpStatusError } = require('common-errors');
const { WEBHOOK_RESOURCE_ID } = require('./constant.js');

/**
 * @class Files
 */
class Files extends Mservice {

  /**
   * Default options for the service
   * @type {Object}
   */
  static defaultOpts = require('./defaults.js');

  /**
   * class Constructor, initializes configuration
   * and internal providers
   */
  constructor(opts = {}) {
    super(ld.merge({}, Files.defaultOpts, opts));
    const config = this._config;

    // extend with storage providers
    StorageProviders(this);

    // init scripts
    this.on('plugin:connect:redisCluster', (redis) => {
      fsort.attach(redis, 'fsort');

      this.log.debug('enabling lock manager');
      this.dlock = new LockManager({
        ...config.lockManager,
        // main connection
        client: redis,
        // second connection
        pubsub: new RedisCluster(config.redis.hosts, config.redis.options),
        log: this.log,
      });

      if (this.config.migrations.enabled === true) {
        this.migrate('redis', `${__dirname}/migrations`);
      }
    });
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
          .then(resourceId => resourceId && redis.set(hookId, resourceId));
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
          .tap(data => this.log.info('stopped channel', data))
          .then(() => this.redis.del(hookId))
          .catch(e => this.log.error('failed to stop channel', e));
      });
  }

  /**
   * Invoke this method to start post-processing of all pending files
   * @return {Promise}
   */
  postProcess = require('./postProcess.js');

  /**
   * Overload close and make sure pubsub is stopped
   * @return {Promise}
   */
  close() {
    return Promise.join(
      super.close(),
      this.dlock.pubsub.disconnect(),
      process.env.WEBHOOK_TERMINATE ? this.stopWebhook() : ld.noop
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
  handleUploadNotification(message) {
    const prefix = this.config.router.routes.prefix;
    return this.router
      .dispatch(`${prefix}.finish`, {
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
      })
      .catch(HttpStatusError, this.logWarn.bind(this, `${prefix}.finish`, message))
      .then(() => Promise.fromCallback(message.ack))
      .catch(() => Promise.fromCallback(message.skip));
  }

  // log failed notification
  logWarn(route, args, e) {
    this.log.warn({ route, args }, e);
  }

  /**
   * Overload connect and make sure we have access to bucket
   * @return {Promise}
   */
  connect() {
    this.log.debug('started connecting');
    return super
      .connect()
      // will be a noop when configuration for it is missing
      .then(() => this.initWebhook())
      // init pubsub if it is present
      .then(() => Promise.map(this.providers, (provider) => {
        if (!provider.config.bucket.channel.pubsub) return null;
        return provider.subscribe(this.handleUploadNotification.bind(this));
      }, { concurrency: 1 }));
  }

}

module.exports = Files;
