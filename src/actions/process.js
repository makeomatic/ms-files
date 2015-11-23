const Errors = require('common-errors');

/**
 * Post process file
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function postProcessFile(opts) {
  const { redis, provider, config } = this;
  const { filename, username } = opts;
  const key = `files-data:${filename}`;

  return redis
    .pipeline()
    .exists(key)
    .hgetall(key)
    .exec()
    .spread((fileExists, data) => {
      if (!fileExists) {
        throw new Errors.HttpStatusError(404, 'could not find associated upload data');
      }

      if (username && data.owner !== username) {
        throw new Errors.HttpStatusError(403, 'file does not belong to the provided user');
      }

      if (data.status === 'processed') {
        throw new Errors.HttpStatusError(412, 'file has already been processed');
      }

      return config.process(provider, data);
    });
};
