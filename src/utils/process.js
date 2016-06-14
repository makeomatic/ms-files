const Promise = require('bluebird');
const omit = require('lodash/omit');
const safeParse = require('./safeParse.js');
const {
  STATUS_PROCESSED,
  UPLOAD_DATA,
  FILES_DATA,
  FILES_PROCESS_ERROR_FIELD,
  FILES_TAGS_FIELD,
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
          const fileData = {
            ...data,
            ...processedData,
            files: JSON.stringify(files),
            [FILES_TAGS_FIELD]: JSON.stringify(parsedTags),
            status: STATUS_PROCESSED,
          };

          return redis
            .pipeline()
            .hmset(`${FILES_DATA}:${uploadId}`, fileData)
            .hdel(`${FILES_DATA}:${uploadId}`, FILES_PROCESS_ERROR_FIELD)
            .del(fileKeys)
            .exec()
            .return({
              ...fileData,
              files,
            });
        })
        .tap(() => lock.extend())
        .tap(finalizedData => this.hook.call(this, 'files:process:post', finalizedData, lock))
        .finally(() => lock.release());
    });
};
