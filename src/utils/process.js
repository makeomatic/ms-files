const Promise = require('bluebird');
const omit = require('lodash/omit');
const safeParse = require('./safeParse.js');
const {
  STATUS_PROCESSED,
  STATUS_PROCESSING,
  STATUS_FAILED,
  UPLOAD_DATA,
  FILES_DATA,
  FILES_PROCESS_ERROR_FIELD,
  FILES_TAGS_FIELD,
  FILES_STATUS_FIELD,
} = require('../constant.js');

// blacklist of metadata that must be returned
const METADATA_BLACKLIST = [
  'location',
];

function parseString(data, returnValue) {
  return typeof data === 'string' ? safeParse(data, returnValue) : data;
}

module.exports = function processFile(key, data) {
  const { redis, dlock } = this;

  return dlock
    .once(`postprocess:${key}`)
    .then(lock => {
      const { uploadId } = data;

      return Promise
        .bind(this, ['files:process:pre', data])
        .spread(this.hook)
        .tap(() => lock.extend())
        .spread((processedData = {}) => {
          // omit location, since it's used once during upload
          const fileKeys = [];
          const parsedFiles = parseString(data.files);
          const parsedTags = parseString(data[FILES_TAGS_FIELD], []);
          const files = parsedFiles.map(file => {
            fileKeys.push(`${UPLOAD_DATA}:${file.filename}`);
            return omit(file, METADATA_BLACKLIST);
          });

          // create new fileData
          const finalizedData = {
            ...data,
            ...processedData,
            files,
            [FILES_TAGS_FIELD]: JSON.stringify(parsedTags),
          };

          return redis
            .hset(`${FILES_DATA}:${uploadId}`, FILES_STATUS_FIELD, STATUS_PROCESSING)
            .return({ finalizedData, parsedTags, fileKeys });
        })
        .tap(() => lock.extend())
        .tap(container => this.hook.call(this, 'files:process:post', container.finalizedData, lock))
        .then(container => redis
          .pipeline()
          .hdel(`${FILES_DATA}:${uploadId}`, FILES_PROCESS_ERROR_FIELD)
          .hmset(`${FILES_DATA}:${uploadId}`, {
            ...container.finalizedData,
            files: JSON.stringify(container.finalizedData.files),
            [FILES_STATUS_FIELD]: STATUS_PROCESSED,
          })
          .del(container.keys)
          .exec()
          .return({
            ...container.finalizedData,
            [FILES_TAGS_FIELD]: container.parsedTags,
            [FILES_STATUS_FIELD]: STATUS_PROCESSED,
          })
        )
        .catch(err => redis
          .hmset(`${FILES_DATA}:${uploadId}`, {
            [FILES_STATUS_FIELD]: STATUS_FAILED,
            [FILES_PROCESS_ERROR_FIELD]: err.message,
          })
          .throw(err)
        )
        .finally(() => lock.release());
    });
};
