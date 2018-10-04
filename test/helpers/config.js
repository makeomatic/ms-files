const set = require('lodash/set');
const { transport } = require('../configs/generic/core');

exports.enablePubsub = function enablePubsub() {
  this.configOverride = {
    transport: [...transport],
  };

  set(transport[0], 'options.bucket.channel', {
    pubsub: {
      topic: 'gcs-object-create',
      name: 'test-runner',
      config: {
        terminate: true,
      },
    },
  });
};
