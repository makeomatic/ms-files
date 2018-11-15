// redis conf
const redisHosts = [7000, 7001, 7002]
  .map(port => ({ host: '172.19.238.10', port }));

exports.redis = {
  hosts: redisHosts,
};

/**
 * Enables plugins. This is a minimum list
 * @type {Array}
 */
exports.plugins = [
  'validator',
  'logger',
  'opentracing',
  'router',
  'amqp',
  'http',
  'redisCluster',
];
