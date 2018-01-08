#!/usr/bin/env node

/**
 * This script applies SKU when it's missing equal to current name of the upload
 */

/* eslint-disable no-console */
const { argv } = require('yargs')
  .describe('user', 'user to scan')
  .describe('filter', 'regexp to filter names')
  .describe('confirm', 'whether to perform update or not, defaults to dry run')
  .describe('overwrite', 'whether to overwrite SKU from older models or not')
  .boolean(['confirm'])
  .demand(['user'])
  .help('h');

// Deps
const Promise = require('bluebird');
const AMQPTransport = require('@microfleet/transport-amqp');
const omit = require('lodash/omit');
const config = require('../lib/config').get('/', { env: process.env.NODE_ENV });

// Configuration
const amqpConfig = omit(config.amqp.transport, ['queue', 'listen', 'neck', 'onComplete']);
const { prefix } = config.router.routes;
const filter = argv.filter && new RegExp(argv.filter);
const iterator = {
  offset: 0,
  limit: 20,
  owner: argv.user,
  criteria: 'startedAt',
  order: 'ASC',
  filter: {
    alias: {
      isempty: true,
    },
  },
  without: ['files'],
  expiration: 100, // small cache size
};

// App level code
const getTransport = () => {
  console.info('establishing connection to amqp with %j', amqpConfig);
  return AMQPTransport.connect(amqpConfig).disposer(amqp => amqp.close());
};

const removeSKU = (amqp, uploadId) => (
  amqp.publishAndWait(`${prefix}.update`, { uploadId, username: argv.user, meta: { alias: '' } })
);

const getInfo = (amqp, filename) => (
  amqp.publishAndWait(`${prefix}.info`, { filename, username: argv.user })
);

const isNewer = (amqp, newUploadId, existingUploadId) => (
  Promise
    .props({
      newData: getInfo(amqp, newUploadId).get('file').get('startedAt'),
      data: getInfo(amqp, existingUploadId).get('file').get('startedAt'),
    })
    .then(({ newData, data }) => {
      const isNew = newData - data > 0;

      if (isNew === false) {
        console.info(
          '[warn] overwrite failed: %s older than %s - [%s / %s] by %s',
          newUploadId, existingUploadId, newData, data, newData - data
        );
      }

      return isNew;
    })
);

// perform update
const performUpdate = (amqp, file) => {
  const { name, uploadId } = file;

  if (filter && filter.test(name) !== true) {
    console.info('[skip] %s -> %s because of %s', uploadId, name, argv.filter);
    return null;
  }

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
    .catch({ statusCode: 409 }, (e) => {
      if (argv.overwrite !== true) throw e;

      console.info('[warn] checking for overwrite of sku <%s>. Currently on <%s>, wants to be on <%s>', name, e.data.uploadId, uploadId);
      return isNewer(amqp, uploadId, e.data.uploadId).then((yes) => {
        // it's not newer, sorry
        if (yes === false) throw e;

        return removeSKU(amqp, e.data.uploadId)
          .then(() => performUpdate(amqp, file));
      });
    })
    .catch((e) => {
      console.info('[warn] failed to set alias <%s> for <%s>: %s', name, uploadId, e.message);
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
    .tap(data => Promise.map(data.files, file => performUpdate(amqp, file), { concurrency: 1 }))
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
