const Errors = require('common-errors');

/**
 * Finish upload
 * @param  {Object} opts.id
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function completeFileUpload(opts) {
  const { redis, provider } = this;
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
        throw new Errors.HttpStatusError(403, 'upload does not belong to the provided user');
      }

      return provider.createSignedURL({
        action: 'read',
        // 3 hours
        expires: Date.now() + 1000 * 60 * 60 * 3,
        // resource
        resource: filename,
      });
    });
};
