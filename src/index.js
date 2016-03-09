const Promise = require('bluebird');
const Mservice = require('mservice');
const ld = require('lodash');
const path = require('path');
const fsort = require('redis-filtered-sort');
const moment = require('moment');
const LockManager = require('dlock');
const postProcess = require('./actions/process.js');
const RedisCluster = require('ioredis').Cluster;
const listFiles = require('./actions/list.js');

// constants
const { STATUS_UPLOADED, WEBHOOK_RESOURCE_ID, FILES_DATA } = require('./constant.js');

/**
 * Message resolver
 */
function resolveMessage(err, data, actionName, actions) {
  if (!err) {
    actions.ack();
    return data;
  }

  const { name } = err;
  if (actionName !== 'process' || name === 'ValidationError' || name === 'HttpStatusError') {
    actions.reject();
    return Promise.reject(err);
  }

  actions.retry();
  return Promise.reject(err);
}

/**
 * @class Files
 */
class Files extends Mservice {

  /**
   * Default options for the service
   * @type {Object}
   */
  static defaultOpts = {
    // enable plugins
    plugins: ['validator', 'logger', 'amqp', 'redisCluster'],
    // default logger
    logger: true,
    // schemas
    validator: ['../schemas'],
    // amqp options
    amqp: {
      // round-robin on this queue name
      queue: 'ms-files',
      // we need QoS for certain operations
      neck: 100,
      // initRoutes and router
      initRoutes: true,
      initRouter: true,
      // prefixes
      prefix: 'files',
      // postfixes for routes
      postfix: path.join(__dirname, 'actions'),
      // add default onComplete handelr
      onComplete: resolveMessage,
    },
    // dlock configuration
    lockManager: {
      lockPrefix: 'dlock!',
      pubsubChannel: '{ms-files}:dlock',
      lock: {
        timeout: 60000,
        retries: 0,
        delay: 100,
      },
    },
    //
    hooks: {
      // specify to work with actions.get
      'files:get:pre': [],
    },
    // storage options
    redis: {
      options: {
        keyPrefix: '{ms-files}',
      },
    },
    // default storage for files
    transport: {
      // transport name
      name: 'gce',
      // provide config options
      options: {},
      // set to true when using as a public name
      cname: false,
    },
    users: {
      audience: '*.localhost',
      getInternalData: 'users.getInternalData',
      getMetadata: 'users.getMetadata',
      updateMetadata: 'users.updateMetadata',
    },
    // function that is used in post-processing of uploaded files
    process: function noop() {
      return Promise.resolve();
    },
  };

  constructor(opts = {}) {
    super(ld.merge({}, Files.defaultOpts, opts));
    const config = this._config;

    // init file transfer provider
    const Provider = require(`ms-files-${config.transport.name}`);
    config.transport.options.logger = this.log;
    this.provider = new Provider(config.transport.options);
    const bucket = config.transport.options.bucket.name;

    if (config.transport.cname === true) {
      config.transport.cname = `https://${bucket}`;
    } else if (config.transport.name === 'gce') {
      config.transport.cname = `https://storage.googleapis.com/${bucket}`;
    }

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

    const { provider, redis } = this;
    return Promise
      .bind(provider)
      .then(() => process.env.WEBHOOK_RESOURCE_ID || redis.get(WEBHOOK_RESOURCE_ID))
      .then(provider.setupChannel)
      .then(resourceId => resourceId && redis.set(WEBHOOK_RESOURCE_ID, resourceId));
  }

  /**
   * Terminate notifications
   */
  stopWebhook() {
    return this
      .provider
      .stopChannel()
      .tap(data => this.log.info('stopped channel', data))
      .then(() => this.redis.del(WEBHOOK_RESOURCE_ID))
      .catch(e => this.log.error('failed to stop channel', e));
  }

  /**
   * Invoke this method to start post-processing of all pending files
   * @return {Promise}
   */
  postProcess(offset = 0, uploadedAt) {
    const filter = {
      status: {
        eq: STATUS_UPLOADED,
      },
      uploadedAt: {
        lte: uploadedAt || moment().subtract(1, 'hour').valueOf(),
      },
    };

    return listFiles
      .call(this, { filter, limit: 20, offset })
      .then(data => {
        const { files, cursor, page, pages } = data;

        return Promise
          .resolve(files)
          .mapSeries(file => {
            // make sure to call reflect so that we do not interrupt the procedure
            return postProcess
              .call(this, `${FILES_DATA}:${file.id}`, file)
              .reflect()
              .tap(result => {
                this.log.info({ owner: file.owner }, '%s | %s', result.isFulfilled() ? 'processed' : 'failed', file.id);
              });
          })
          .then(() => {
            if (page < pages) {
              return this.postProcess(cursor, filter.uploadedAt.lte);
            }

            return null;
          });
      })
      .then(() => {
        this.log.info('completed files post-processing');
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
      process.env.WEBHOOK_TERMINATE ? this.stopWebhook() : ld.noop
    );
  }

  /**
   * Overload connect and make sure we have access to bucket
   * @return {Promise}
   */
  connect() {
    this.log.debug('started connecting');
    return Promise
      .join(super.connect(), this.provider.connect())
      .then(() => this.initWebhook()); // will be a noop when configuration for it is missing
  }

}

module.exports = Files;
