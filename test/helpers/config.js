const set = require('lodash/set');
const { transport } = require('../configs/generic/core');
const { transport: awsTransport } = require('../configs/generic/aws');

exports.enablePubsub = function enablePubsub() {
  console.log('overrideAwsTransport', awsTransport);
  this.configOverride = {
    transport: [...awsTransport],
  };

  set(transport[0], 'options.bucket.channel', {
    pubsub: {
      topic: 'gcs-object-create',
      name: `test-runner-${Math.random()}`,
      config: {
        terminate: true,
      },
    },
  });
};
