const set = require('lodash/set');
const { transport } = require('../configs/generic/core');

exports.enablePubsub = async function enablePubsub() {
  this.configOverride = {
    transport: [...transport],
  };

  set(this.configOverride.transport[0], 'options.bucket.channel', {
    pubsub: {
      topic: 'gcs-object-create',
      name: `test-runner-${Math.random()}`,
      config: {
        terminate: true,
      },
    },
  });
};
