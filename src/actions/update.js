const Promise = require('bluebird');
const { FILES_DATA, FILES_INDEX_TAGS, FILES_TAGS_FIELD } = require('../constant.js');
const fetchData = require('../utils/fetchData.js');
const isProcessed = require('../utils/isProcessed.js');

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
  const { redis } = this;
  const key = `${FILES_DATA}:${uploadId}`;
  const meta = opts.meta;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(isProcessed)
    .tap(data => this.postHook.call(this, 'files:update:pre', username, data))
    .then(data => Promise.try(function updateMetadata() {
      const pipeline = redis.pipeline();

      if (data[FILES_TAGS_FIELD]) {
        data[FILES_TAGS_FIELD].forEach(tag => pipeline.srem(`${FILES_INDEX_TAGS}:${tag}`, uploadId));
      }

      if (meta[FILES_TAGS_FIELD]) {
        meta[FILES_TAGS_FIELD].forEach(tag => {
          const tagKey = `${FILES_INDEX_TAGS}:${tag}`;
          pipeline.sadd(tagKey, uploadId);
        });
        meta[FILES_TAGS_FIELD] = JSON.stringify(meta[FILES_TAGS_FIELD]);
      }

      return pipeline
        .hmset(key, meta)
        .exec()
        .return(true);
    }));
};
