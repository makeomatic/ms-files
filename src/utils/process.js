const Promise = require('bluebird');
const omit = require('lodash/omit');
const stringify = require('./stringify.js');
const bustCache = require('./bustCache.js');
const { HttpStatusError } = require('common-errors');
const {
  STATUS_PROCESSED,
  STATUS_PROCESSING,
  STATUS_FAILED,
  UPLOAD_DATA,
  FILES_DATA,
  FILES_PROCESS_ERROR_FIELD,
  FILES_STATUS_FIELD,
  FIELDS_TO_STRINGIFY,
} = require('../constant.js');

const STRINGIFY_LIST = [
  ...FIELDS_TO_STRINGIFY,
  'files',
];

// blacklist of metadata that must be returned
const METADATA_BLACKLIST = [
  'location',
];

module.exports = function processFile(key, data) {
  const { redis, dlock } = this;

  return dlock
    .once(`postprocess:${key}`)
    .catch({ name: 'LockAcquisitionError' }, () => {
      throw new HttpStatusError(409, 'file is being processed');
    })
    .then((lock) => {
      const { uploadId } = data;

      return Promise
        .bind(this, ['files:process:pre', data])
        .spread(this.hook)
        .tap(() => lock.extend())
        .spread((processedData = {}) => {
          // omit location, since it's used once during upload
          const fileKeys = [];
          const files = data.files.map((file) => {
            fileKeys.push(`${UPLOAD_DATA}:${file.filename}`);
            return omit(file, METADATA_BLACKLIST);
          });

          // create new fileData
          const finalizedData = {
            ...data,
            ...processedData,
            files,
          };

          return redis
            .hset(`${FILES_DATA}:${uploadId}`, FILES_STATUS_FIELD, STATUS_PROCESSING)
            .return({ finalizedData, fileKeys });
        })
        .tap(() => lock.extend())
        .tap(container => this.hook.call(this, 'files:process:post', container.finalizedData, lock))
        .then((container) => {
          const serialized = {};
          STRINGIFY_LIST.forEach((field) => {
            stringify(container.finalizedData, field, serialized);
          });

          return redis
            .pipeline()
            .hdel(`${FILES_DATA}:${uploadId}`, FILES_PROCESS_ERROR_FIELD)
            .hmset(`${FILES_DATA}:${uploadId}`, {
              ...container.finalizedData,
              ...serialized,
              [FILES_STATUS_FIELD]: STATUS_PROCESSED,
            })
            .hdel(`${FILES_DATA}:${uploadId}`, 'export')
            .del(container.keys)
            .exec()
            .return({
              ...container.finalizedData,
              [FILES_STATUS_FIELD]: STATUS_PROCESSED,
            });
        })
        // await for cache busting since we acquired a lock
        .tap(bustCache(redis, true))
        .catch(err => redis
          .hmset(`${FILES_DATA}:${uploadId}`, {
            [FILES_STATUS_FIELD]: STATUS_FAILED,
            [FILES_PROCESS_ERROR_FIELD]: err.message,
          })
          .throw(err),
        )
        .finally(() => lock.release());
    });
};
