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
  'router-hapi',
  'amqp',
  'router-amqp',
  'hapi',
  'redis-sentinel',
  'prometheus',
  'dlock',
];
