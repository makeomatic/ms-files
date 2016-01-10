const { HttpStatusError } = require('common-errors');

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
  const key = filename ? `files-data:${filename}` : `upload-data:${uploadId}`;

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
        .then(() => {
          const pipeline = redis.pipeline();
          pipeline.del(key);

          // removes from indices
          if (filename) {
            pipeline.srem('files-index', data.filename);
            if (username) {
              pipeline.srem(`files-index:${username}`, data.filename);
            }
          }

          return pipeline.exec();
        });
    });
};
