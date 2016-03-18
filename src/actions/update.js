const Promise = require('bluebird');
const { FILES_DATA } = require('../constant.js');
const getFileData = require('../utils/getFileData.js');
const hasAccess = require('../utils/hasAccess.js');
const isProcessed = require('../utils/isProcessed.js');

/**
 * Initiates update
 * @param  {Object} opts
 * @param  {Object} opts.meta
 * @param  {String} opts.uploadId
 * @param  {String} opts.username
 * @return {Promise}
 */
module.exports = function initFileUpdate(opts) {
  const { meta, uploadId, username } = opts;
  const { provider, redis } = this;
  const key = `${FILES_DATA}:${uploadId}`;

  return Promise
    .bind(this, key)
    .then(getFileData)
    .then(isProcessed)
    .then(data => {
      if (!username) {
        throw new HttpStatusError(403, 'file does not belong to the provided user');
      } else {
        hasAccess(username)(data);
        return redis
          .pipeline()
          .hmset(key, meta)
          .hgetall(key)
          .exec()
          .spread((setResult, getResult) => {
            return getResult[1];
          });
      }
    });
};
