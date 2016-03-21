const Promise = require('bluebird');
const { FILES_DATA } = require('../constant.js');
const getUploadStatus = require('../utils/getUploadStatus.js');
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
  const { uploadId, username } = opts;
  const { provider, redis } = this;
  const key = `${FILES_DATA}:${uploadId}`;
  let meta = opts.meta;

  return Promise
    .bind(this, key)
    .then(getUploadStatus)
    .then(isProcessed)
    .then(hasAccess(username))
    .then(data => {

      if (meta.tags)
        meta.tags = JSON.stringify(meta.tags);

      return redis
        .pipeline()
        .hmset(key, meta)
        .hgetall(key)
        .exec()
        .spread((setResult, getResult) => {
          return getResult[1];
        });

    })
    .then(data => {
      if (data.tags)
        data.tags = JSON.parse(data.tags);

      return data;
    });
};
