const Errors = require('common-errors');

/**
 * Post process file
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function postProcessFile(opts) {
  const { redis, provider, _config: config } = this;
  const { filename, username } = opts;
  const key = `files-data:${filename}`;

  return redis
    .pipeline()
    .exists(key)
    .hgetall(key)
    .exec()
    .spread((fileExistsResponse, dataResponse) => {
      const fileExists = fileExistsResponse[1];
      const data = dataResponse[1];

      if (!fileExists) {
        throw new Errors.HttpStatusError(404, 'could not find associated upload data');
      }

      if (username && data.owner !== username) {
        throw new Errors.HttpStatusError(403, 'file does not belong to the provided user');
      }

      if (data.status === 'processed') {
        throw new Errors.HttpStatusError(412, 'file has already been processed');
      }

      return config.process(provider, { key, data, redis })
        .tap(() => {
          return redis.hset(key, 'status', 'processed');
        });
    });
};
