const { HttpStatusError } = require('common-errors');
const { STATUS_PROCESSED } = require('../constant.js');
const postProcess = require('../utils/process.js');

/**
 * Post process file
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function postProcessFile(opts) {
  const { redis } = this;
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
        throw new HttpStatusError(404, 'could not find associated upload data');
      }

      if (username && data.owner !== username) {
        throw new HttpStatusError(403, 'file does not belong to the provided user');
      }

      if (data.status === STATUS_PROCESSED) {
        throw new HttpStatusError(412, 'file has already been processed');
      }

      return postProcess.call(this, key, data);
    });
};
