const { ActionTransport } = require('@microfleet/plugin-router');
const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const ld = require('lodash');
const handlePipeline = require('../utils/pipeline-error');
const fetchData = require('../utils/fetch-data');
const isProcessed = require('../utils/is-processed');
const isUnlisted = require('../utils/is-unlisted');
const hasAccess = require('../utils/has-access');
const isAliasTaken = require('../utils/is-alias-taken');
const stringify = require('../utils/stringify');
const isValidBackgroundOrigin = require('../utils/is-valid-background-origin');
const { assertUpdatable, assertReferenceOnAccessChange } = require('../utils/check-data');
const { bustCache } = require('../utils/bust-cache');
const { updateReferences, verifyReferences, isReferenceChanged, getReferenceData } = require('../utils/reference');
const { normalizeForSearch } = require('../utils/normalize-name');

const {
  FILES_TAGS_FIELD,
  FIELDS_TO_STRINGIFY,
  FILES_USR_ALIAS_PTR,
  FILES_ALIAS_FIELD,
  FILES_OWNER_FIELD,
  FILES_DIRECT_ONLY_FIELD,
  FILES_INDEX_PUBLIC,
  FILES_PUBLIC_FIELD,
  LOCK_UPDATE_KEY,
  FILES_DATA_INDEX_KEY,
  FILES_TAGS_INDEX_KEY,
  FILES_USER_INDEX_PUBLIC_KEY,
  FILES_PLAYER_SETTINGS_FIELD,
  FILES_VERSION_FIELD,
  FILES_NFT_FIELD,
  FILES_HAS_NFT,
  FILES_IMMUTABLE_FIELD,
  FILES_NFT_OWNER_FIELD,
  FILES_HAS_NFT_OWNER_FIELD,
  FILES_HAS_REFERENCES_FIELD,
  FILES_REFERENCES_FIELD,
  FILES_NAME_FIELD,
  FILES_NAME_NORMALIZED_FIELD,
} = require('../constant');

const { call } = Function.prototype;
const { toLowerCase } = String.prototype;

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
    const origLen = alias.length;

    data.alias = alias.trim();
    if (origLen > 0 && data.alias.length === 0) {
      throw new HttpStatusError(400, 'empty alias after trim');
    }
  }

  return data;
}

/**
 * Process metadata remove operation
 * @param  {Object} pipeline
 * @param  {Object} meta
 */
function handleRemoveFromMeta(pipeline, key, meta, data) {
  const { $remove } = meta;

  if ($remove && $remove.length > 0) {
    const existsData = ld.pick(data, $remove);
    const esistsKeys = ld.keys(existsData);

    pipeline.hdel(key, esistsKeys);

    $remove.forEach((removeKey) => {
      delete meta[removeKey];
    });
    delete meta.$remove;
  }
}

async function updateMeta(lock, ctx, params) {
  const { uploadId, username, directOnly, immutable, includeReferences } = params;
  const { redis } = ctx;
  const key = FILES_DATA_INDEX_KEY(uploadId);
  const meta = preProcessMetadata(params.meta);
  const alias = meta[FILES_ALIAS_FIELD];

  const data = await Promise
    .bind(ctx, meta)
    // do some extra validation
    .tap(isValidBackgroundOrigin)
    // fetch data
    .return(key)
    .then(fetchData)
    .then(isProcessed)
    .then(isUnlisted)
    .then(hasAccess(username))
    .then(isAliasTaken(alias))
    .then(assertUpdatable(meta))
    .then(assertReferenceOnAccessChange(meta, params));

  // ensure we still hold the lock
  await lock.extend();

  // call hook
  await ctx.hook.call(ctx, 'files:update:pre', username, data);

  const referencesChanged = meta[FILES_REFERENCES_FIELD] && isReferenceChanged(meta, data);
  const newReferences = meta[FILES_REFERENCES_FIELD];
  const referencedInfo = referencesChanged
    ? await getReferenceData(redis, [...newReferences, ...data[FILES_REFERENCES_FIELD] || []])
    : {};

  if (referencesChanged) {
    verifyReferences(data, referencedInfo, newReferences);
  }

  // perform update
  const pipeline = redis.pipeline();

  // insert reference to current alias for fast lookup within that user
  const existingAlias = data[FILES_ALIAS_FIELD];
  const owner = data[FILES_OWNER_FIELD];
  const aliasPTRs = `${FILES_USR_ALIAS_PTR}:${owner}`;
  const userPublicIndex = FILES_USER_INDEX_PUBLIC_KEY(owner);
  const isPublic = data[FILES_PUBLIC_FIELD];

  // update version
  const nftImage = meta.nft && meta.nft.image;
  const prevImage = data.nft && data.nft.image;

  if (nftImage && nftImage !== prevImage) {
    pipeline.hincrby(key, FILES_VERSION_FIELD, 1);
  }

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

  handleRemoveFromMeta(pipeline, key, meta, data);

  if (hasOwnProperty.call(meta, FILES_TAGS_FIELD) && data[FILES_TAGS_FIELD]) {
    // @todo migrate all tags in files data to lowercase and then remove this tag.toLowerCase()
    for (const tag of data[FILES_TAGS_FIELD].values()) {
      pipeline.srem(FILES_TAGS_INDEX_KEY(tag.toLowerCase()), uploadId);
    }
  }

  // there is no way to remove a meta field, only overwrite
  if (meta[FILES_PLAYER_SETTINGS_FIELD]) {
    meta[FILES_PLAYER_SETTINGS_FIELD] = { ...data[FILES_PLAYER_SETTINGS_FIELD], ...meta[FILES_PLAYER_SETTINGS_FIELD] };
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

  if (referencesChanged) {
    updateReferences(meta, data, referencedInfo, pipeline);
  }

  if (immutable === true) {
    pipeline.hset(key, FILES_IMMUTABLE_FIELD, '1');

    // set referenced items immutable if requested
    if (includeReferences) {
      const references = referencesChanged ? meta[FILES_REFERENCES_FIELD] : data[FILES_REFERENCES_FIELD];

      (references || []).forEach((id) => {
        pipeline.hset(FILES_DATA_INDEX_KEY(id), FILES_IMMUTABLE_FIELD, '1');
      });
    }
  }

  // make sure it's not an empty object
  if (hasProperties(meta)) {
    // to index using this property with redis-search
    if (meta[FILES_NFT_FIELD]) {
      meta[FILES_HAS_NFT] = '1';
    }

    if (meta[FILES_NFT_OWNER_FIELD]) {
      meta[FILES_HAS_NFT_OWNER_FIELD] = '1';
    }

    if (Array.isArray(meta[FILES_REFERENCES_FIELD]) && meta[FILES_REFERENCES_FIELD].length > 0) {
      meta[FILES_HAS_REFERENCES_FIELD] = '1';
    } else {
      delete meta[FILES_HAS_REFERENCES_FIELD];
      pipeline.hdel(key, FILES_HAS_REFERENCES_FIELD);
    }

    for (const field of FIELDS_TO_STRINGIFY.values()) {
      stringify(meta, field);
    }

    // renaming file, adjust normalized name, too
    if (meta[FILES_NAME_FIELD]) {
      meta[FILES_NAME_NORMALIZED_FIELD] = normalizeForSearch(meta[FILES_NAME_FIELD]);
    }

    pipeline.hmset(key, meta);
  }

  handlePipeline(await pipeline.exec());

  if (directOnly !== undefined || (meta.nft && !data.nft)) {
    await bustCache(redis, data, true, true);
  }

  return true;
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

  const keys = [LOCK_UPDATE_KEY(uploadId)];
  const alias = meta[FILES_ALIAS_FIELD];

  // if we remove it - we don't care, so both undefined and '' works
  if (alias) {
    keys.push(`file:update:alias:${alias}`);
  }

  if (meta[FILES_REFERENCES_FIELD]) {
    meta[FILES_REFERENCES_FIELD].forEach((referenceId) => {
      keys.push(LOCK_UPDATE_KEY(referenceId));
    });
  }

  // ensure there are no race-conditions
  return Promise.using(this.dlock.acquireLock(...keys), this, params, updateMeta);
}

initFileUpdate.transports = [ActionTransport.amqp];
module.exports = initFileUpdate;
