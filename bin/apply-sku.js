#!/usr/bin/env node

/**
 * This script applies SKU when it's missing equal to current name of the upload
 */

/* eslint-disable no-console */

const argv = require('yargs')
  .describe('user', 'user to scan')
  .describe('confirm', 'whether to perform update or not, defaults to dry run')
  .boolean(['confirm'])
  .demand(['user'])
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
const iterator = {
  offset: 0,
  limit: 20,
  owner: argv.user,
  fitler: {
    alias: {
      isempty: true,
    },
  },
  without: ['files'],
};

// App level code
const getTransport = () => {
  console.info('establishing connection to amqp with %j', amqpConfig);
  return AMQPTransport.connect(amqpConfig).disposer(amqp => amqp.close());
};

// perform update
const performUpdate = (amqp, file) => {
  const { name, uploadId } = file;

  if (argv.confirm !== true) {
    console.info('[dry-run] set alias for %s to %s', uploadId, name);
    return null;
  }

  return amqp
    .publishAndWait(`${prefix}.update`, { uploadId, username: argv.user, meta: { alias: name } }, { timeout: 5000 })
    .then(() => {
      console.log('set alias for %s to %s', uploadId, name);
      return null;
    })
    .catch((e) => {
      console.warn('[warn] failed to set alias to %s for %s: %s', name, uploadId, e.message);
    });
};

// performs listing of files, which contain no SKU
const listAndUpdate = (amqp) => {
  console.info('requesting %d files on the page %d', iterator.limit, (iterator.offset / iterator.limit) + 1);

  return amqp
    .publishAndWait(`${prefix}.list`, iterator, { timeout: 5000 })
    .tap((data) => {
      if (iterator.offset === 0) {
        console.info('pages found: %d', data.pages);
      }
    })
    .tap(data => Promise.map(data.files, file => performUpdate(amqp, file)))
    .tap((data) => {
      // recursively work on the next page
      if (data.page < data.pages) {
        iterator.offset = data.cursor;
        return listAndUpdate(amqp);
      }

      return null;
    });
};

Promise.using(getTransport(), listAndUpdate);
