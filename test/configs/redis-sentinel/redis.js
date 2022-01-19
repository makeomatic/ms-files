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
  'amqp',
  'hapi',
  'router',
  'router-amqp',
  'router-hapi',
  'redis-sentinel',
  'prometheus',
];
