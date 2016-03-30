const Promise = require('bluebird');
const { FILES_DATA, FILES_INDEX_TAGS } = require('../constant.js');
const fetchData = require('../utils/fetchData.js');
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
    .then(fetchData)
    .then(isProcessed)
    .tap(data => this.postHook('files:update:pre', username, data))
    .then(data => Promise.try(function updateMetadata() {
      const pipeline = redis.pipeline();

      if (data.tags) {
        let tags = JSON.parse(data.tags);
        tags.forEach(tag => {
          const tagKey = `${FILES_INDEX_TAGS}:${tag}`;
          pipeline.srem(tagKey, uploadId);
        });
      }

      if (meta.tags) {
        meta.tags.forEach(tag => {
          const tagKey = `${FILES_INDEX_TAGS}:${tag}`;
          pipeline.sadd(tagKey, uploadId);
        });
        meta.tags = JSON.stringify(meta.tags);
      }

      return pipeline
        .hmset(key, meta)
        .exec()
        .return(true);
    }));
};
