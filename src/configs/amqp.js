const resolveMessage = require('../messageResolver');

exports.amqp = {
  transport: {
    // round-robin on this queue name
    queue: 'ms-files',
    // we need QoS for certain operations
    neck: 100,
    // add default onComplete handelr
    onComplete: resolveMessage,
  },
  router: {
    enabled: true,
  },
};
