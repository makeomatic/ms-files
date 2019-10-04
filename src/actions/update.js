const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const noop = require('lodash/noop');
const handlePipeline = require('../utils/pipelineError');
const getLock = require('../utils/acquireLock');
const fetchData = require('../utils/fetchData');
const isProcessed = require('../utils/isProcessed');
const isUnlisted = require('../utils/isUnlisted');
const hasAccess = require('../utils/hasAccess');
const isAliasTaken = require('../utils/isAliasTaken');
const stringify = require('../utils/stringify');
const isValidBackgroundOrigin = require('../utils/isValidBackgroundOrigin');
const { bustCache } = require('../utils/bustCache.js');
const {
  FILES_TAGS_FIELD,
  FIELDS_TO_STRINGIFY,
  FILES_USR_ALIAS_PTR,
  FILES_ALIAS_FIELD,
  FILES_OWNER_FIELD,
  FILES_DIRECT_ONLY_FIELD,
  FILES_INDEX,
  FILES_INDEX_PUBLIC,
  FILES_PUBLIC_FIELD,
  LOCK_UPDATE_KEY,
  FILES_DATA_INDEX_KEY,
  FILES_TAGS_INDEX_KEY,
} = require('../constant.js');

const { call } = Function.prototype;
const { toLowerCase } = String.prototype;

// init disposer
function acquireLock(uploadId, alias) {
  const keys = [LOCK_UPDATE_KEY(uploadId)];

  // if we remove it - we don't care, so both undefined and '' works
  if (alias) {
    keys.push(`file:update:alias:${alias}`);
  }

  return getLock(this, ...keys);
}

// cache ref
const { hasOwnProperty } = Object.prototype;

function hasProperties(obj) {
  let k;
  // eslint-disable-next-line
  for (k in obj) {
    if (hasOwnProperty.call(obj, k)) return true;
  }

  return false;
}

/**
 * Process provided metadata
 * @param data - File MetaData
 * */
function preProcessMetadata(data) {
  const { description, alias } = data;

  // Trim extra spaces in case of typo
  if (description != null && typeof description === 'string') {
    data.description = description.trim();
  }
  if (alias != null && typeof alias === 'string') {
    data.alias = alias.trim();
  }

  return data;
}

function updateMeta(params) {
  const {
    uploadId, username, directOnly,
  } = params;
  const { redis } = this;
  const key = FILES_DATA_INDEX_KEY(uploadId);
  const meta = preProcessMetadata(params.meta);
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
    .tap((data) => this.hook.call(this, 'files:update:pre', username, data))
    // perform update
    .then((data) => {
      const pipeline = redis.pipeline();

      // insert reference to current alias for fast lookup within that user
      const existingAlias = data[FILES_ALIAS_FIELD];
      const owner = data[FILES_OWNER_FIELD];
      const aliasPTRs = `${FILES_USR_ALIAS_PTR}:${owner}`;
      const userPublicIndex = `${FILES_INDEX}:${owner}:pub`;
      const isPublic = data[FILES_PUBLIC_FIELD];

      if (alias) {
        pipeline.hset(aliasPTRs, alias, uploadId);
        if (existingAlias) {
          pipeline.hdel(aliasPTRs, existingAlias);
        }
      } else if (alias === '' && existingAlias) {
        pipeline
          .hdel(aliasPTRs, existingAlias)
          .hdel(key, FILES_ALIAS_FIELD);
      }

      // ensure that we do nothing if we don't have existing alias
      if (alias === '') {
        delete meta[FILES_ALIAS_FIELD]; // <-- this field is empty at this point
      }

      if (hasOwnProperty.call(meta, FILES_TAGS_FIELD) && data[FILES_TAGS_FIELD]) {
        // @todo migrate all tags in files data to lowercase and then remove this tag.toLowerCase()
        data[FILES_TAGS_FIELD].forEach((tag) => pipeline.srem(FILES_TAGS_INDEX_KEY(tag.toLowerCase()), uploadId));
      }

      if (meta[FILES_TAGS_FIELD]) {
        meta[FILES_TAGS_FIELD] = meta[FILES_TAGS_FIELD].map(call, toLowerCase);
        meta[FILES_TAGS_FIELD].forEach((tag) => pipeline.sadd(FILES_TAGS_INDEX_KEY(tag), uploadId));
      }

      if (directOnly === false) {
        pipeline.hdel(key, FILES_DIRECT_ONLY_FIELD);
        // remove from public indices if it is public
        if (isPublic) {
          pipeline.sadd(FILES_INDEX_PUBLIC, uploadId);
          pipeline.sadd(userPublicIndex, uploadId);
        }
      } else if (directOnly === true) {
        pipeline.hset(key, FILES_DIRECT_ONLY_FIELD, '1');
        // add back to public indices if this file is public
        if (isPublic) {
          pipeline.srem(FILES_INDEX_PUBLIC, uploadId);
          pipeline.srem(userPublicIndex, uploadId);
        }
      }

      FIELDS_TO_STRINGIFY.forEach((field) => {
        stringify(meta, field);
      });

      // make sure it's not an empty object
      if (hasProperties(meta)) {
        pipeline.hmset(key, meta);
      }

      return pipeline
        .exec()
        .then(handlePipeline)
        .tap(directOnly !== undefined ? bustCache(redis, data, true) : noop)
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
function initFileUpdate({ params }) {
  const { uploadId, meta } = params;

  // ensure there are no race-conditions
  return Promise.using(
    acquireLock.call(this, uploadId, meta[FILES_ALIAS_FIELD]),
    () => updateMeta.call(this, params)
  );
}

initFileUpdate.transports = [ActionTransport.amqp];
module.exports = initFileUpdate;
