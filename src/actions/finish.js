const Promise = require('bluebird');
const fetchData = require('../utils/fetchData.js');
const handlePipeline = require('../utils/pipelineError');
const { HttpStatusError } = require('common-errors');
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
} = require('../constant.js');

// cached vars
const fields = [
  FILES_STATUS_FIELD, FILES_PARTS_FIELD, FILES_TAGS_FIELD,
  FILES_OWNER_FIELD, FILES_PUBLIC_FIELD, FILES_TEMP_FIELD,
  FILES_UNLISTED_FIELD,
];

const MissingError = new HttpStatusError(200, '404: could not find upload');
const AlreadyProcessedError = new HttpStatusError(200, '412: upload was already processed');

/**
 * Finish upload
 * @param  {Object} opts
 * @param  {Object} opts.params
 * @param  {String} opts.params.filename
 * @param  {Boolean} opts.params.skipProcessing
 * @param  {Boolean} opts.params.await
 * @return {Promise}
 */
module.exports = function completeFileUpload({ params }) {
  const { filename } = params;
  const { redis, config, amqp } = this;
  const key = `${UPLOAD_DATA}:${filename}`;
  const prefix = config.router.routes.prefix;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .catchThrow({ statusCode: 404 }, MissingError)
    .then((data) => {
      if (data[FILES_STATUS_FIELD] !== STATUS_PENDING) {
        // we do not send 412, because google might decide to delay notifications
        throw new HttpStatusError(200, '412: upload has already been marked as finished');
      }

      const { uploadId } = data;
      const uploadKey = `${FILES_DATA}:${uploadId}`;
      const postActionKey = `${FILES_POST_ACTION}:${uploadId}`;

      // set to uploaded
      return Promise.props({
        uploadId,
        postActionKey,
        update: redis
          .pipeline()
          .hmget(uploadKey, fields)
          .hincrby(uploadKey, 'uploaded', 1)
          .exists(postActionKey)
          .hmset(key, {
            status: STATUS_UPLOADED,
            uploadedAt: Date.now(),
          })
          .exec()
          .then(handlePipeline),
      });
    })
    .then((data) => {
      const { uploadId, update, postActionKey } = data;
      const [parts, currentParts, postAction] = update;

      // destructure array
      // annoying redis format :(
      const [
        currentStatus,
        totalParts,
        tags,
        username,
        isPublic,
        isTemporary,
        isUnlisted,
      ] = parts;

      if (currentParts < totalParts) {
        throw new HttpStatusError(202, `${currentParts}/${totalParts} uploaded`);
      }

      // define upload key
      const uploadKey = `${FILES_DATA}:${uploadId}`;

      // if not pending
      if (currentStatus !== STATUS_PENDING) {
        this.log.error({ params, username }, 'Upload %s already has %s status', filename, currentStatus);

        // we do not send 412, because google might decide to delay notifications
        // also, we've increased the counter of uploaded files, but it was already counted
        return redis
          .hincrby(uploadKey, 'uploaded', -1)
          .throw(AlreadyProcessedError);
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
          pipeline.sadd(`${FILES_INDEX}:${username}`, uploadId);

          // convert 1 or undef to Boolean
          if (isPublic) {
            pipeline.sadd(FILES_INDEX_PUBLIC, uploadId);
            pipeline.sadd(`${FILES_INDEX}:${username}:pub`, uploadId);
          }

          // push to tags index
          if (tags) {
            JSON.parse(tags).forEach((tag) => {
              pipeline.sadd(`${FILES_INDEX_TAGS}:${tag}`, uploadId);
            });
          }
        }
      }

      if (postAction) {
        pipeline.persist(postActionKey);
      }

      return pipeline
        .exec()
        .then(handlePipeline)
        .return(uploadId);
    })
    .then((uploadId) => {
      if (params.skipProcessing) {
        return 'upload completed, processing skipped';
      }

      const action = params.await ? 'publishAndWait' : 'publish';
      const route = `${prefix}.process`;
      return amqp[action](route, { uploadId });
    });
};
