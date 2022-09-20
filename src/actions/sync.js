/**
 * @typedef { import('@microfleet/core-types').Microfleet } Microfleet
 * @typedef { import('@microfleet/ioredis-lock').Lock } Lock
 * @typedef { import('@microfleet/plugin-dlock') }
 */

const { ActionTransport } = require('@microfleet/plugin-router');
const Promise = require('bluebird');
const moment = require('moment');
const { STATUS_PENDING, FILES_INDEX_TEMP, FILES_STATUS_FIELD } = require('../constant');

// cached filter
const filter = { [FILES_STATUS_FIELD]: { gte: +STATUS_PENDING, lte: +STATUS_PENDING } };

/**
 * Iterates over files with pending state and tries
 * @param  {Microfleet} service
 * @param  {Lock} lock
 * @param  {{ offset: number, limit: number }} opts
 * @return {Promise}
 */
async function iterateOverUploadedFiles(service, lock, opts = {}) {
  const { amqp, redis, provider, config: { uploadTTL, router } } = service;
  const { offset = 0, limit = 10 } = opts;
  const route = `${router.routes.prefix}.finish`;

  // ensure we still have lock
  await lock.extend();

  const params = { offset, limit, filter, temp: true, expiration: 10000 };
  const data = await service.dispatch('list', { params });

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
 * @this Microfleet
 */
module.exports = function sync() {
  return Promise
    .using(this, this.dlock.acquireLock('bucket-sync'), iterateOverUploadedFiles);
};

module.exports.transports = [ActionTransport.amqp];
