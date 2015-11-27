const Promise = require('bluebird');
const Mservice = require('mservice');
const ld = require('lodash');
const fs = require('fs');
const path = require('path');
const sortedFilteredListLua = fs.readFileSync(path.resolve(__dirname, '../lua/sorted-filtered-list.lua'), 'utf-8');

/**
 * Message resolver
 */
function resolveMessage(err, data, actionName, actions) {
  if (!err) {
    actions.ack();
    return data;
  }

  if (!(actionName === 'process' && err.name === 'HttpStatusError')) {
    actions.reject();
    throw err;
  }

  actions.retry();
  throw err;
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
    plugins: [ 'validator', 'logger', 'amqp', 'redisCluster' ],
    // default logger
    logger: true,
    // schemas
    validator: [ '../schemas' ],
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
    // define onComplete
    opts.amqp.onComplete = resolveMessage;

    super(ld.merge({}, Files.defaultOpts, opts));
    const config = this._config;

    // init file transfer provider
    const Provider = require(`ms-files-${config.transport.name}`);
    config.transport.options.logger = this.log;
    this.provider = new Provider(config.transport.options);

    // init scripts
    this.on('plugin:connect:redisCluster', (redis) => {
      redis.defineCommand('sortedFilteredFilesList', {
        numberOfKeys: 2,
        lua: sortedFilteredListLua,
      });
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
