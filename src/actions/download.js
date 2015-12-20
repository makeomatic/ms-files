const Promise = require('bluebird');
const Errors = require('common-errors');

/**
 * Get download url
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function getDownloadURL(opts) {
  const { redis, provider } = this;
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
        throw new Errors.HttpStatusError(403, 'upload does not belong to the provided user');
      }

      if (username && data.status !== 'processed') {
        throw new Errors.HttpStatusError(412, 'your upload has not been processed yet');
      }

      return Promise.props({
        url: provider.createSignedURL({
          action: 'read',
          // 3 hours
          expires: Date.now() + 1000 * 60 * 60 * 3,
          // resource
          resource: filename,
          // filename
          promptSaveAs: data.humanName || 'cappasity-model',
        }),
        data,
      });
    });
};
