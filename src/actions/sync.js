const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const fsort = require('redis-filtered-sort');
const moment = require('moment');
const list = require('./list');
const acquireLock = require('../utils/acquire-lock');
const { STATUS_PENDING, FILES_INDEX_TEMP } = require('../constant');

// cached filter
const filter = fsort.filter({ status: { eq: STATUS_PENDING } });

/**
 * Iterates over files with pending state and tries
 * @param  {Object} lock
 * @param  {Object} opts
 * @return {Promise}
 */
async function iterateOverUploadedFiles(service, lock, opts = {}) {
  const { amqp, redis, provider, config: { uploadTTL, router } } = service;
  const { offset = 0, limit = 10 } = opts;
  const route = `${router.routes.prefix}.finish`;

  // ensure we still have lock
  await lock.extend();

  const params = { offset, limit, filter, temp: true, expiration: 10000 };
  const data = await Promise.bind(service, { params }).then(list);

  // ensure we still have lock
  await lock.extend();

  // we resolved files, now iterate over them
  const { files, cursor, page, pages } = data;

  // found files
  service.log.debug('found files ~ %d/%d/%d', cursor, page, pages);

  await Promise.map(files, async (container) => {
    // transport to fetch "exists" data
    const transport = provider('sync', container);
    const started = moment(parseInt(container.startedAt, 10));

    // cleanup after 0.5 TTL, so that we have time to react for id without meta
    if (moment().diff(started, 'seconds') >= uploadTTL * 0.5) {
      await redis.srem(FILES_INDEX_TEMP, container.uploadId);
      return;
    }

    await Promise.map(container.files, async (file) => {
      const exists = await transport.exists(file.filename);
      service.log.debug('checked file %s | %s', file.filename, exists);

      if (!exists) {
        return null;
      }

      return amqp.publish(route, { filename: file.filename });
    });
  }, { concurrency: 10 });

  if (page >= pages) {
    return null;
  }

  return iterateOverUploadedFiles(service, lock, { offset: cursor, limit });
}

/**
 * Performs sync of state for pending uploads
 */
module.exports = function sync() {
  return Promise
    .using(this, acquireLock(this, 'bucket-sync'), iterateOverUploadedFiles);
};

module.exports.transports = [ActionTransport.amqp];
