const { ActionTransport } = require('@microfleet/plugin-router');
const Promise = require('bluebird');
const assert = require('assert');
const { HttpStatusError } = require('common-errors');
const fetchData = require('../utils/fetch-data');
const handlePipeline = require('../utils/pipeline-error');
const {
  STATUS_UPLOADED,
  STATUS_PENDING,
  UPLOAD_DATA,
  FILES_INDEX,
  FILES_DATA,
  FILES_INDEX_TEMP,
  FILES_INDEX_PUBLIC,
  FILES_INDEX_TAGS,
  FILES_OWNER_FIELD,
  FILES_PUBLIC_FIELD,
  FILES_TAGS_FIELD,
  FILES_TEMP_FIELD,
  FILES_STATUS_FIELD,
  FILES_PARTS_FIELD,
  FILES_UNLISTED_FIELD,
  FILES_POST_ACTION,
  FILES_DIRECT_ONLY_FIELD,
  FILES_USER_INDEX_KEY,
  FILES_USER_INDEX_PUBLIC_KEY,
} = require('../constant');

// cached vars
const fields = [
  FILES_PARTS_FIELD, FILES_TAGS_FIELD,
  FILES_OWNER_FIELD, FILES_PUBLIC_FIELD, FILES_TEMP_FIELD,
  FILES_UNLISTED_FIELD, FILES_DIRECT_ONLY_FIELD,
];

const jsonFields = JSON.stringify(fields);

const MissingError = new HttpStatusError(200, '404: could not find upload');
const AlreadyProcessedError = new HttpStatusError(200, '412: upload was already processed');
const PartialProcessingError = new HttpStatusError(202, '');
const is404 = { statusCode: 404 };
const is409 = { message: '409' };

/**
 * Finish upload
 * @param  {Object} opts
 * @param  {Object} opts.params
 * @param  {String} opts.params.filename
 * @param  {Boolean} opts.params.skipProcessing
 * @param  {Boolean} opts.params.await
 * @return {Promise}
 */
async function completeFileUpload({ params }) {
  const { filename } = params;
  const { redis, config, amqp, provider } = this;
  const { prefix } = config.router.routes;
  const uploadPartKey = `${UPLOAD_DATA}:${filename}`;

  const data = await Promise
    .bind(this, uploadPartKey)
    .then(fetchData)
    .catchThrow(is404, MissingError);

  // we do not send 412, because google might decide to delay notifications
  assert.equal(data[FILES_STATUS_FIELD], STATUS_PENDING, AlreadyProcessedError);

  // ensure it was actually uploaded
  const transport = provider('sync', data);
  const exists = await transport.exists(filename);
  assert.equal(exists, true, MissingError);

  const { uploadId } = data;
  const uploadKey = `${FILES_DATA}:${uploadId}`;
  const postActionKey = `${FILES_POST_ACTION}:${uploadId}`;
  const updateKeys = [uploadKey, postActionKey, uploadPartKey];
  const updateArgs = [Date.now(), FILES_STATUS_FIELD, STATUS_UPLOADED, STATUS_PENDING, 'uploaded', jsonFields];

  // set to uploaded
  const update = await redis
    .markAsUploaded(3, updateKeys, updateArgs)
    .catchThrow(is409, AlreadyProcessedError);

  const [parts, currentParts, postAction] = update;

  // destructure array
  // annoying redis format :(
  const [
    totalParts,
    tags,
    username,
    isPublic,
    isTemporary,
    isUnlisted,
    isDirectOnly,
  ] = parts;

  // use pooled error to avoid stack generation
  if (currentParts < totalParts) {
    PartialProcessingError.message = `${currentParts}/${totalParts} uploaded`;
    throw PartialProcessingError;
  }

  const pipeline = redis.pipeline();

  // update key
  pipeline.hmset(uploadKey, {
    status: STATUS_UPLOADED,
    uploadedAt: Date.now(),
  });

  // remove reference
  pipeline.srem(FILES_INDEX_TEMP, uploadId);

  // unless file is temp -> add them to index
  if (!isTemporary) {
    pipeline.persist(uploadKey);

    if (!isUnlisted) {
      pipeline.sadd(FILES_INDEX, uploadId);
      pipeline.sadd(FILES_USER_INDEX_KEY(username), uploadId);

      // convert 1 or undef to Boolean
      // if `isDirectOnly` is truthy, we won't publish this in the public index
      if (isPublic && !isDirectOnly) {
        pipeline.sadd(FILES_INDEX_PUBLIC, uploadId);
        pipeline.sadd(FILES_USER_INDEX_PUBLIC_KEY(username), uploadId);
      }

      // push to tags index
      if (tags) {
        for (const tag of JSON.parse(tags)) {
          pipeline.sadd(`${FILES_INDEX_TAGS}:${tag}`, uploadId);
        }
      }
    }
  }

  if (postAction) {
    pipeline.persist(postActionKey);
  }

  await pipeline.exec().then(handlePipeline);

  if (params.skipProcessing) {
    return 'upload completed, processing skipped';
  }

  const action = params.await ? 'publishAndWait' : 'publish';
  const route = `${prefix}.process`;
  return amqp[action](route, { uploadId });
}

completeFileUpload.transports = [ActionTransport.amqp];

module.exports = completeFileUpload;
