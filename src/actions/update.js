const Promise = require('bluebird');
const { FILES_DATA, FILES_INDEX_TAGS } = require('../constant.js');
const getUploadStatus = require('../utils/getUploadStatus.js');
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
    .then(data => ['files:update:pre', username, data])
    .spread(this.postHook)
    .then(() => Promise.try(function updateMetadata() {
      const pipeline = redis.pipeline();

      if (meta.tags) {
        meta.tags.forEach(tag => {
          const tagKey = `${FILES_INDEX_TAGS}:${tag}`;
          pipeline.sadd(tagKey, uploadId);
        });

        delete meta.tags;
      }

      return pipeline
        .hmset(key, meta)
        .exec()
        .spread((...args) => {
          const resultOfSet = args[args.length - 1];
          return resultOfSet[1];
        });
    }));
};
