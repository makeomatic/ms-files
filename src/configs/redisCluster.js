const path = require('path');

/**
 * Redis Cluster adapter configuration
 * @type {Object}
 */
exports.redis = {
  options: {
    keyPrefix: '{ms-files}',
    lazyConnect: true,
    redisOptions: {
      dropBufferSupport: true,
    },
  },
  luaScripts: path.resolve(__dirname, '../../lua'),
};
