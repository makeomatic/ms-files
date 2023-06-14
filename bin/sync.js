#!/usr/bin/env node

/**
 * This script applies SKU when it's missing equal to current name of the upload
 */

/* eslint-disable no-console */

const { argv } = require('yargs')
  .describe('confirm', 'init sync')
  .boolean(['confirm'])
  .help('h');

// Deps
const AMQPTransport = require('@microfleet/transport-amqp');
const omit = require('lodash/omit');
const { initStore } = require('../src/config');

(async () => {
  // Configuration
  const store = await initStore({ env: process.env.NODE_ENV });
  const config = store.get('/');

  // Configuration
  const amqpConfig = omit(config.amqp.transport, ['queue', 'listen', 'neck', 'onComplete']);
  const { prefix } = config.router.routes;

  // App level code
  const getTransport = () => {
    return AMQPTransport.connect({ ...amqpConfig, debug: false });
  };

  // perform update
  const performSync = (amqp) => {
    if (argv.confirm !== true) {
      console.info('[dry-run] not launching sync');
      return null;
    }

    return amqp
      .publishAndWait(`${prefix}.sync`, {}, { timeout: 60000 })
      .then(() => {
        console.log('sync completed');
        return null;
      })
      .catch((e) => {
        console.warn('[warn] failed to perform sync', e.message);
      });
  };

  const transport = await getTransport();
  try {
    await performSync(transport);
  } finally {
    await transport.close();
  }
})();
