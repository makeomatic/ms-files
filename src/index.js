const Promise = require('bluebird');
const Mservice = require('mservice');
const ld = require('lodash');
const path = require('path');
const fsort = require('redis-filtered-sort');
const listFiles = require('./actions/list.js');
const moment = require('moment');
const { STATUS_UPLOADED } = require('./constant.js');
const LockManager = require('dlock');
const postProcess = require('./utils/process.js');

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
    lockManager: {
      lockPrefix: 'dlock!',
      pubsubChannel: '{ms-files}:dlock',
      lock: {
        timeout: 60000,
        retries: 0,
        delay: 100,
      },
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

    // init scripts
    this.on('plugin:connect:redisCluster', (redis) => {
      fsort.attach(redis, 'fsort');

      this.log.debug('enabling lock manager');
      this.dlock = new LockManager({
        client: redis,
        pubsub: redis,
        log: this.log,
        ...config.lockManager,
      });
    });
  }

  /**
   * Invoke this method to start post-processing all pending files
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
      .then(({ files, cursor, page, pages }) => {
        return Promise.mapSeries(files, file => {
          // make sure to call reflect so that we do not interrupt the procedure
          return postProcess
            .call(this, file.filename, file)
            .reflect();
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
   * Overload connect and make sure we have access to bucket
   * @return {Promise}
   */
  connect() {
    this.log.debug('started connecting');
    return Promise.join(super.connect(), this.provider.connect());
  }

}

module.exports = Files;
