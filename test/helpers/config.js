const set = require('lodash/set');
const assert = require('node:assert/strict');
const { initStore } = require('../../src/config');

exports.enablePubsub = async function enablePubsub() {
  const store = await initStore({ env: process.env.NODE_ENV });
  const transportConfig = store.get('/transport');

  assert(transportConfig[0].options?.gce?.credentials?.client_email);

  set(transportConfig[0], 'options.bucket.channel', {
    pubsub: {
      topic: 'gcs-object-create',
      name: `test-runner-${Math.random()}`,
      config: {
        terminate: true,
      },
    },
  });

  this.configOverride = {
    transport: transportConfig,
  };
};
