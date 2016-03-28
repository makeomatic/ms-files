const Promise = require('bluebird');
const omit = require('lodash/omit');
const { STATUS_PROCESSED, UPLOAD_DATA, FILES_DATA, FILES_PROCESS_ERROR_FIELD } = require('../constant.js');

// blacklist of metadata that must be returned
const METADATA_BLACKLIST = [
  'location',
];

module.exports = function processFile(key, data) {
  const { redis, dlock } = this;

  return dlock
    .once(`postprocess:${key}`)
    .then(lock => {
      const { uploadId } = data;

      return Promise
        .bind(this, ['files:process:post', data])
        .spread(this.postHook)
        .spread((processedData = {}) => {
          // omit location, since it's used once during upload
          const fileKeys = [];
          const parsedFiles = typeof data.files === 'string' ? JSON.parse(data.files) : data.files;
          const files = parsedFiles.map(file => {
            fileKeys.push(`${UPLOAD_DATA}:${file.filename}`);
            return omit(file, METADATA_BLACKLIST);
          });

          // create new fileData
          const fileData = {
            ...data,
            ...processedData,
            files: JSON.stringify(files),
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
        .finally(() => lock.release());
    });
};
