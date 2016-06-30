const Promise = require('bluebird');
const fetchData = require('../utils/fetchData.js');
const isProcessed = require('../utils/isProcessed.js');
const isUnlisted = require('../utils/isUnlisted.js');
const stringify = require('../utils/stringify.js');
const {
  FILES_DATA,
  FILES_INDEX_TAGS,
  FILES_TAGS_FIELD,
  FIELDS_TO_STRINGIFY,
} = require('../constant.js');

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
    .then(isUnlisted)
    .tap(data => this.hook.call(this, 'files:update:pre', username, data))
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
      }

      FIELDS_TO_STRINGIFY.forEach(field => {
        stringify(meta, field);
      });

      return pipeline
        .hmset(key, meta)
        .exec()
        .return(true);
    }));
};
