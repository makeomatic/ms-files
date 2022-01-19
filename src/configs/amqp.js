exports.amqp = {
  transport: {
    // round-robin on this queue name
    queue: 'ms-files',
    // we need QoS for certain operations
    neck: 100,
    // bind headers
    bindPersistantQueueToHeadersExchange: true,
  },
};
