const Errors = require('common-errors');
const Promise = require('bluebird');
const Mservice = require('mservice');
const ld = require('lodash');
const fs = require('fs');
const sortedFilteredListLua = fs.readFileSync(path.resolve(__dirname, '../lua/sorted-filtered-list.lua'), 'utf-8');

/**
 * @class Files
 */
module.exports = class Files extends Mservice {

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
      postfix: {
        // constructs signed download URL for the file. if an <id> is provided - checks access rights
        // if not - just gives a URL.
        download: 'download',
        // constructs resumable upload
        // binds it to provided <id>. If upload is not finished in X hours
        // URL is revoked, any information regarding this id is erased as well
        upload: 'upload',
        // notify about finished file upload
        // use this to store data associated with upload <id> permanently
        // and launch post process sequence
        finish: 'finish',
        // sends file for post processing
        // can be used from `finish` route, as well as on demand
        process: 'process',
        // provides information for the requested file
        // if <id> is specified, access rights are checked before returning the info
        info: 'info',
        // list - provides list of files that belong to some <id>, allows sorting, filtering and paginating
        // if no id is specified - iterates over all files that were uploaded
        list: 'list',
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
    this.provider = new Provider(config.transport.options);

    // init scripts
    this.on('plugin:connect:redisCluster', (redis) => {
      redis.defineCommand('sortedFilteredList', {
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
    return Promise.join(super.connect(), this.provider.connect());
  }

};
