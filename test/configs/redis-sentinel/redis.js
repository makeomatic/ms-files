exports.redis = {
  sentinels: [{
    host: 'redis-sentinel',
    port: 26379,
  }],
  name: 'mservice',
  options: {},
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
  'redis-sentinel',
  'prometheus',
  'dlock',
];
