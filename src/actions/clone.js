const { ActionTransport } = require('@microfleet/plugin-router');
const { v4: uuidv4 } = require('uuid');
const Promise = require('bluebird');

const fetchData = require('../utils/fetch-data');
const isProcessed = require('../utils/is-processed');
const isUnlisted = require('../utils/is-unlisted');
const { assertImmutable } = require('../utils/is-immutable');

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
  FILES_CLONED_AT,
  LOCK_CLONE_KEY,
  FILES_PARENT_FIELD,
  FILES_ID_FIELD,
} = require('../constant');

/**
 * Create copy of the selected file
 * @param  {Object} params.uploadId
 * @param  {Object} params.owner
 * @return {Promise}
 */
async function cloneFile(lock, ctx, params) {
  const { uploadId, username } = params;
  const { redis } = ctx;

  const data = await Promise
    .bind(ctx)
    .return(FILES_DATA_INDEX_KEY(uploadId))
    .then(fetchData)
    .then(isProcessed)
    .then(isUnlisted)
    .then(assertImmutable);

  await lock.extend();

  const pipeline = redis.pipeline();

  const uploadedAt = Date.now();
  const isPublic = data[FILES_PUBLIC_FIELD];
  const newOwnerPublicIndex = FILES_USER_INDEX_PUBLIC_KEY(username);
  const newUploadId = uuidv4();
  const newModelKey = FILES_DATA_INDEX_KEY(newUploadId);

  // delete alias for now
  delete data[FILES_ALIAS_FIELD];

  // copy generic info
  data[FILES_PARENT_FIELD] = uploadId;
  data[FILES_ID_FIELD] = newUploadId;
  data[FILES_CLONED_AT] = Date.now();

  // add model to user and global indexes
  pipeline.sadd(FILES_USER_INDEX_KEY, newUploadId);
  pipeline.sadd(FILES_INDEX, newUploadId);
  pipeline.zadd(FILES_INDEX_UAT, uploadedAt, newUploadId);
  pipeline.zadd(FILES_USER_INDEX_UAT_KEY(username), uploadedAt, newUploadId);

  if (data[FILES_TAGS_FIELD]) {
    data[FILES_TAGS_FIELD].forEach((tag) => pipeline.sadd(FILES_TAGS_INDEX_KEY(tag), newUploadId));
  }

  if (data[FILES_DIRECT_ONLY_FIELD]) {
    if (isPublic) {
      pipeline.sadd(FILES_INDEX_PUBLIC, newUploadId);
      pipeline.sadd(newOwnerPublicIndex, newUploadId);
    }
  }

  pipeline.hmset(newModelKey, data);

  handlePipeline(await pipeline.exec());

  return { uploadId: newUploadId };
}

function cloneFileAction({ params }) {
  const { uploadId } = params;

  const keys = [LOCK_CLONE_KEY(uploadId)];

  return Promise.using(this.dlock.acquireLock(...keys), this, params, cloneFile);
}

cloneFileAction.transports = [ActionTransport.amqp];
module.exports = cloneFileAction;
