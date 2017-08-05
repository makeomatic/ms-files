// make sure we dont reject .process right away
const processRegExp = /\.process$/;
const isProcess = name => processRegExp.test(name);

exports.amqp = {
  transport: {
    // round-robin on this queue name
    queue: 'ms-files',
    // we need QoS for certain operations
    neck: 100,
    // bind headers
    bindPersistantQueueToHeadersExchange: true,
  },
  router: {
    enabled: true,
  },
  retry: {
    enabled: true,
    min: 100,
    max: 3000,
    factor: 2,
    maxRetries: 5,
    predicate(error, actionName) {
      switch (error.name) {
        case 'ValidationError':
        case 'HttpStatusError':
          return true;

        default:
          return isProcess(actionName) === false;
      }
    },
  },
};
