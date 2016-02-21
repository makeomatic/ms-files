const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const { FILES_INDEX, FILES_DATA, UPLOAD_DATA, FILES_PUBLIC_FIELD } = require('../constant.js');
const fetchData = require('../utils/fetchData.js');

/**
 * Initiates upload
 * @param  {Object} opts
 * @param  {String} opts.username
 * @param  {String} opts.filename
 * @return {Promise}
 */
module.exports = function removeFile(opts) {
  const { filename, username, uploadId } = opts;
  const { redis, provider } = this;
  const key = filename ? `${FILES_DATA}:${filename}` : `${UPLOAD_DATA}:${uploadId}`;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(data => {
      if (username && data.owner !== username) {
        throw new HttpStatusError(403, 'upload does not belong to the provided user');
      }

      return provider
        .remove(data.filename)
        .catch({ code: 404 }, err => {
          throw new HttpStatusError(err.code, err.message);
        })
        .then(() => {
          const pipeline = redis.pipeline();
          pipeline.del(key);

          // removes from indices
          if (data.filename) {
            pipeline.srem(FILES_INDEX, data.filename);
            if (data.owner) {
              pipeline.srem(`${FILES_INDEX}:${data.owner}`, data.filename);
              if (data[FILES_PUBLIC_FIELD]) {
                pipeline.srem(`${FILES_INDEX}:${data.owner}:pub`, data.filename);
              }
            }
          }

          if (data.uploadId) {
            pipeline.del(`${UPLOAD_DATA}:${data.uploadId}`);
          }

          return pipeline.exec();
        });
    });
};
