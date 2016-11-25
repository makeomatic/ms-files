const Promise = require('bluebird');
const fetchData = require('../utils/fetchData');
const isProcessed = require('../utils/isProcessed');
const isUnlisted = require('../utils/isUnlisted');
const hasAccess = require('../utils/hasAccess');
const isAliasTaken = require('../utils/isAliasTaken');
const stringify = require('../utils/stringify');
const isValidBackgroundOrigin = require('../utils/isValidBackgroundOrigin');
const {
  FILES_DATA,
  FILES_INDEX_TAGS,
  FILES_TAGS_FIELD,
  FIELDS_TO_STRINGIFY,
  FILES_USR_ALIAS_PTR,
  FILES_ALIAS_FIELD,
  FILES_OWNER_FIELD,
} = require('../constant.js');

// init disposer
function acquireLock(uploadId, alias) {
  const keys = [`file:update:${uploadId}`];

  // if we remove it - we don't care, so both undefined and '' works
  if (alias) {
    keys.push(`file:update:alias:${alias}`);
  }

  return this
    .dlock
    .multi(keys)
    .disposer(lock => lock.release());
}

function updateMeta(params) {
  const { uploadId, username, meta } = params;
  const { redis } = this;
  const key = `${FILES_DATA}:${uploadId}`;
  const alias = meta[FILES_ALIAS_FIELD];

  return Promise
    .bind(this, meta)
    // do some extra validation
    .tap(isValidBackgroundOrigin)
    // fetch data
    .return(key)
    .then(fetchData)
    .then(isProcessed)
    .then(isUnlisted)
    // TODO: this check was not performed earlier, why?
    .then(hasAccess(username))
    .then(isAliasTaken(alias))
    // call hook
    .tap(data => this.hook.call(this, 'files:update:pre', username, data))
    // perform update
    .then((data) => {
      const pipeline = redis.pipeline();

      // insert reference to current alias for fast lookup within that user
      const existingAlias = data[FILES_ALIAS_FIELD];
      const aliasPTRs = `${FILES_USR_ALIAS_PTR}:${data[FILES_OWNER_FIELD]}`;

      if (alias) {
        pipeline.hset(aliasPTRs, alias, uploadId);
      } else if (alias === '' && existingAlias) {
        pipeline
          .hdel(aliasPTRs, existingAlias)
          .hdel(key, FILES_ALIAS_FIELD);
      }

      // ensure that we do nothing if we don't have existing alias
      if (alias === '') {
        delete meta[FILES_ALIAS_FIELD]; // <-- this field is empty at this point
      }

      if (data[FILES_TAGS_FIELD]) {
        data[FILES_TAGS_FIELD].forEach(tag => pipeline.srem(`${FILES_INDEX_TAGS}:${tag}`, uploadId));
      }

      if (meta[FILES_TAGS_FIELD]) {
        meta[FILES_TAGS_FIELD].forEach((tag) => {
          const tagKey = `${FILES_INDEX_TAGS}:${tag}`;
          pipeline.sadd(tagKey, uploadId);
        });
      }

      FIELDS_TO_STRINGIFY.forEach((field) => {
        stringify(meta, field);
      });

      return pipeline
        .hmset(key, meta)
        .exec()
        .return(true);
    });
}

/**
 * Initiates update
 * @param  {Object}  opts
 * @param  {Object}  opts.meta
 * @param  {String}  opts.uploadId
 * @param  {String}  opts.username
 * @return {Promise}
 */
module.exports = function initFileUpdate({ params }) {
  const { uploadId, meta } = params;

  // ensure there are no race-conditions
  return Promise.using(
    acquireLock.call(this, uploadId, meta[FILES_ALIAS_FIELD]),
    () => updateMeta.call(this, params)
  );
};
