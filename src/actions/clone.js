const { ActionTransport } = require('@microfleet/plugin-router');
const { v4: uuidv4 } = require('uuid');
const Promise = require('bluebird');

const fetchData = require('../utils/fetch-data');
const isProcessed = require('../utils/is-processed');
const isUnlisted = require('../utils/is-unlisted');
const { assertImmutable } = require('../utils/check-data');
const { bustCache } = require('../utils/bust-cache');
const stringify = require('../utils/stringify');
const handlePipeline = require('../utils/pipeline-error');

const {
  FILES_DATA_INDEX_KEY,
  FILES_USER_INDEX_KEY,
  FILES_INDEX,
  FILES_USER_INDEX_PUBLIC_KEY,
  FILES_ALIAS_FIELD,
  FILES_TAGS_FIELD,
  FILES_TAGS_INDEX_KEY,
  FILES_DIRECT_ONLY_FIELD,
  FILES_PUBLIC_FIELD,
  FILES_INDEX_PUBLIC,
  FILES_INDEX_UAT,
  FILES_USER_INDEX_UAT_KEY,
  FILES_CLONED_AT_FIELD,
  FILES_PARENT_FIELD,
  FILES_ID_FIELD,
  FILES_HAS_CLONES_FIELD,
  LOCK_CLONE_KEY,
  LOCK_UPDATE_KEY,
  FIELDS_TO_STRINGIFY,
  FILES_FILES_FIELD,
  FILES_OWNER_FIELD,
  FILES_IS_CLONE_FIELD,
} = require('../constant');

/**
 * Create data clone of the selected file. Do not copies files in the buckets
 * @param  {Object} params.uploadId
 * @param  {Object} params.owner
 * @param  {Object} [params.meta] - extra metadata to update
 * @return {Promise}
 */
async function cloneFile(lock, ctx, params) {
  const { uploadId, username, meta } = params;
  const { redis } = ctx;
  const uploadKey = FILES_DATA_INDEX_KEY(uploadId);
  const uploadData = await Promise
    .bind(ctx)
    .return(uploadKey)
    .then(fetchData)
    .then(isProcessed)
    .then(isUnlisted)
    .then(assertImmutable);

  await lock.extend();

  const pipeline = redis.pipeline();

  const uploadedAt = Date.now();
  const isPublic = uploadData[FILES_PUBLIC_FIELD];
  const newOwnerPublicIndex = FILES_USER_INDEX_PUBLIC_KEY(username);
  const newUploadId = uuidv4();
  const newUploadKey = FILES_DATA_INDEX_KEY(newUploadId);

  // delete alias for now
  delete uploadData[FILES_ALIAS_FIELD];

  // copy generic info
  uploadData[FILES_PARENT_FIELD] = uploadId;
  uploadData[FILES_ID_FIELD] = newUploadId;
  uploadData[FILES_OWNER_FIELD] = username;
  uploadData[FILES_CLONED_AT_FIELD] = Date.now();
  uploadData[FILES_IS_CLONE_FIELD] = '1';

  delete uploadData[FILES_HAS_CLONES_FIELD];

  const mergedData = { ...uploadData, ...meta };

  // add model to user and global indexes
  pipeline.sadd(FILES_USER_INDEX_KEY(username), newUploadId);
  pipeline.sadd(FILES_INDEX, newUploadId);
  pipeline.zadd(FILES_INDEX_UAT, uploadedAt, newUploadId);
  pipeline.zadd(FILES_USER_INDEX_UAT_KEY(username), uploadedAt, newUploadId);

  if (mergedData[FILES_TAGS_FIELD]) {
    mergedData[FILES_TAGS_FIELD].forEach((tag) => pipeline.sadd(FILES_TAGS_INDEX_KEY(tag), newUploadId));
  }

  for (const field of [...FIELDS_TO_STRINGIFY.values(), FILES_FILES_FIELD]) {
    stringify(mergedData, field);
  }

  if (!mergedData[FILES_DIRECT_ONLY_FIELD] && isPublic) {
    pipeline.sadd(FILES_INDEX_PUBLIC, newUploadId);
    pipeline.sadd(newOwnerPublicIndex, newUploadId);
  }

  // add mark to the original file
  pipeline.hset(uploadKey, FILES_HAS_CLONES_FIELD, 1);

  pipeline.hmset(newUploadKey, mergedData);

  await await ctx.hook.call(ctx, 'files:clone:before-pipeline-exec', pipeline, mergedData);

  handlePipeline(await pipeline.exec());

  await bustCache(redis, mergedData, true, true);

  return {
    uploadId: newUploadId,
    username,
  };
}

function cloneFileAction({ params }) {
  const { uploadId } = params;

  const keys = [LOCK_CLONE_KEY(uploadId), LOCK_UPDATE_KEY(uploadId)];

  return Promise.using(this.dlock.acquireLock(...keys), this, params, cloneFile);
}

cloneFileAction.transports = [ActionTransport.amqp];
module.exports = cloneFileAction;
