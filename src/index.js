const Promise = require('bluebird');
const Mservice = require('mservice');
const ld = require('lodash');
const fsort = require('redis-filtered-sort');
const LockManager = require('dlock');
const RedisCluster = require('ioredis').Cluster;
const StorageProviders = require('ms-files-providers');

// constants
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
   * Overload connect and make sure we have access to bucket
   * @return {Promise}
   */
  connect() {
    this.log.debug('started connecting');
    return super
      .connect()
      .then(() => this.initWebhook()); // will be a noop when configuration for it is missing
  }

}

module.exports = Files;
