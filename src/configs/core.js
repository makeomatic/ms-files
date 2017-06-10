const path = require('path');

/**
 * Default name of the service
 * @type {String}
 */
exports.name = 'ms-files';

/**
 * Enables plugins. This is a minimum list
 * @type {Array}
 */
exports.plugins = [
  'validator',
  'logger',
  'router',
  'amqp',
  'redisCluster',
];

/**
 * Bunyan logger configuration
 * by default only ringBuffer logger is enabled in prod
 * @type {Boolean}
 */
exports.logger = {
  defaultLogger: true,
  debug: process.env.NODE_ENV === 'development',
};

/**
 * Debug settings
 * @type {Boolean}
 */
exports.debug = process.env.NODE_ENV !== 'production';

/**
 * Local schemas for validation
 * @type {Array}
 */
exports.validator = {
  schemas: [path.resolve(__dirname, '../../schemas')],
  ajv: {
    $meta: 'ms-validation AJV schema validator options',
  },
};

/**
 * Default hooks
 * @type {Object}
 */
exports.hooks = {
  'files:info:pre': [],
  'files:upload:pre': [],
  'files:update:pre': [],
  'files:process:pre': [],
  'files:process:post': [],
  'files:info:post': [],
};

/**
 * Redis lock settings
 * @type {Object}
 */
exports.lockManager = {
  lockPrefix: 'dlock!',
  pubsubChannel: '{ms-files}:dlock',
  lock: {
    timeout: 60000,
    retries: 0,
    delay: 100,
  },
};

/**
 * Default storage settings for transport
 * @type {Array}
 */
exports.transport = [{
  // transport name
  name: 'gce',
  // provide config options
  options: {},
  // set to true when using as a public name
  cname: false,
}];

/**
 * Default selectTransport settings
 * @returns {Provider}
 */
exports.selectTransport = function selectTransport() {
  return this.providers[0];
};

/**
 * User service configuration
 * @type {Object}
 */
exports.users = {
  audience: '*.localhost',
  exportAudience: 'ms-files',
  getInternalData: 'users.getInternalData',
  getMetadata: 'users.getMetadata',
  updateMetadata: 'users.updateMetadata',
};

/**
 * TTL of key for action list in seconds
 * @type {Number}
 */
exports.interstoreKeyTTL = 15;

/**
 * minimum remaining time(ms) to a previously saved key for action list
 * @type {Number}
 */
exports.interstoreKeyMinTimeleft = 2000;

/**
 * upload expiration time ~ 24 hours
 * @type {Number}
 */
exports.uploadTTL = 60 * 60 * 24;

/**
 * max tries for post-processing
 * @type {Number}
 */
exports.maxTries = Infinity;

/**
 * Migration settings
 * @type {Object}
 */
exports.migrations = {
  enabled: true,
};
