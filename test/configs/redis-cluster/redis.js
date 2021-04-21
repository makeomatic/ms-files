// redis conf
const redisHosts = [7000, 7001, 7002]
  .map((port) => ({ host: 'redis-cluster', port }));

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
  'router-http',
  'amqp',
  'router-amqp',
  'http',
  'redis-cluster',
  'prometheus',
  'dlock',
];
