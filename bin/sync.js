#!/usr/bin/env node

/**
 * This script applies SKU when it's missing equal to current name of the upload
 */

/* eslint-disable no-console */

const argv = require('yargs')
  .describe('confirm', 'init sync')
  .boolean(['confirm'])
  .help('h')
  .argv;

// Deps
const Promise = require('bluebird');
const Files = require('../lib/index');
const AMQPTransport = require('ms-amqp-transport');
const omit = require('lodash/omit');
const merge = require('lodash/merge');
const configOverride = require('ms-conf').get('/');

// Configuration
const config = merge({}, Files.defaultOpts, configOverride);
const amqpConfig = omit(config.amqp.transport, ['queue', 'listen', 'neck', 'onComplete']);
const prefix = config.router.routes.prefix;

// App level code
const getTransport = () => {
  console.info('establishing connection to amqp with %j', amqpConfig);
  return AMQPTransport.connect(amqpConfig).disposer(amqp => amqp.close());
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

Promise.using(getTransport(), performSync);
