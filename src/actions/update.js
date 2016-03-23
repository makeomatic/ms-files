const Promise = require('bluebird');
const { FILES_DATA } = require('../constant.js');
const getUploadStatus = require('../utils/getUploadStatus.js');
const hasAccess = require('../utils/hasAccess.js');
const isProcessed = require('../utils/isProcessed.js');
const { HttpStatusError } = require('common-errors');

/**
 * Initiates update
 * @param  {Object}  opts
 * @param  {Object}  opts.meta
 * @param  {String}  opts.uploadId
 * @param  {String}  opts.username
 * @return {Promise}
 */
module.exports = function initFileUpdate(opts) {
  const { uploadId, username } = opts;
  const { provider, redis } = this;
  const key = `${FILES_DATA}:${uploadId}`;
  let meta = opts.meta;

  return Promise
    .bind(this, key)
    .then(getUploadStatus)
    .then(isProcessed)
    .then(data => {

      if (!username) {
        throw new HttpStatusError(403, 'file does not belong to the provided user');
      }

      return Promise
        .bind(this, ['files:update:pre', username])
        .spread(this.postHook)
        .spread(isAdmin => {
          if (isAdmin) {
            return;
          } else {
            return hasAccess(username)(data);
          }
        });

    })
    .then(() => {
      return Promise.try(function updateMetadata() {

        if (meta.tags) {
          meta.tags = JSON.stringify(meta.tags);
        }

        return redis
          .pipeline()
          .hmset(key, meta)
          .exec()
          .spread(result => {
            return result[1];
          });
      });
    });
};
