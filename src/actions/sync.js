const Promise = require('bluebird');
const fsort = require('redis-filtered-sort');
const { STATUS_PENDING, FILES_INDEX_TEMP } = require('../constant.js');
const filter = fsort.filter({ status: { eq: STATUS_PENDING } });
const moment = require('moment');

// action
const list = require('./list.js');

/**
 * Iterates over files with pending state and tries
 * @param  {Object} lock
 * @param  {Object} opts
 * @return {Promise}
 */
function iterateOverUploadedFiles(lock, opts = {}) {
  const { amqp, redis, provider, config: { uploadTTL, amqp: { prefix } } } = this;
  const { offset = 0, limit = 10 } = opts;
  const route = `${prefix}.finish`;

  return Promise
    .bind(this, { offset, limit, filter, temp: true, expiration: 10000 })
    .then(list)
    .then(data => {
      // we resolved files, now iterate over them
      const { files, cursor, page, pages } = data;

      // found files
      this.log.debug('found files ~ %d/%d/%d', cursor, page, pages);

      return Promise.map(files, container => {
        // transport to fetch "exists" data
        const transport = provider('sync', container);
        const started = moment(container.startedAt);

        // cleanup after 0.5 TTL, so that we have time to react for id without meta
        if (moment().diff(started, 'seconds') >= uploadTTL * 0.5) {
          return redis.srem(FILES_INDEX_TEMP, container.uploadId);
        }

        return Promise
          .map(container.files, file => transport.exists(file.filename).then(exists => {
            this.log.debug('checked file %s | %s', file.filename, exists);

            if (!exists) {
              return null;
            }

            return amqp.publish(route, { filename: file.filename });
          }));
      })
      .then(() => {
        if (page >= pages) {
          return null;
        }

        return iterateOverUploadedFiles.call(this, lock, { offset: cursor, limit });
      });
    });
}

/**
 * Performs sync of state for pending uploads
 */
module.exports = function sync() {
  const acquireLock = () => this.dlock
    .once('bucket-sync')
    .disposer(lock => lock.release());

  return Promise.using(acquireLock, lock => iterateOverUploadedFiles.call(this, lock));
};
