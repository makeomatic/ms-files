const { HttpStatusError } = require('common-errors');
const { FILES_INDEX, FILES_DATA, UPLOAD_DATA } = require('../constant.js');

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

  return redis
    .pipeline()
    .exists(key)
    .hgetall(key)
    .exec()
    .spread((fileExistsResponse, dataResponse) => {
      const fileExists = fileExistsResponse[1];
      const data = dataResponse[1];

      if (!fileExists) {
        throw new HttpStatusError(404, 'could not find associated upload data ' + key);
      }

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
            }
          }

          if (data.uploadId) {
            pipeline.del(`${UPLOAD_DATA}:${data.uploadId}`);
          }

          return pipeline.exec();
        });
    });
};
