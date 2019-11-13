const path = require('path');

/**
 * Redis Cluster adapter configuration
 * @type {Object}
 */
exports.redis = {
  options: {
    keyPrefix: '{ms-files}',
    lazyConnect: true,
  },
  luaScripts: path.resolve(__dirname, '../../lua'),
};
