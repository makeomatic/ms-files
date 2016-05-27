const Promise = require('bluebird');
const fetchData = require('../utils/fetchData.js');
const { HttpStatusError } = require('common-errors');
const {
  STATUS_UPLOADED, STATUS_PENDING,
  UPLOAD_DATA,
  FILES_INDEX, FILES_DATA, FILES_INDEX_PUBLIC, FILES_INDEX_TAGS,
  FILES_OWNER_FIELD, FILES_PUBLIC_FIELD, FILES_TAGS_FIELD, FILES_TEMP_FIELD,
} = require('../constant.js');

/**
 * Finish upload
 * @param  {Object}  opts
 * @param  {String}  opts.filename
 * @param  {Boolean} opts.skipProcessing
 * @param  {Boolean} opts.await
 * @return {Promise}
 */
module.exports = function completeFileUpload(opts) {
  const { filename } = opts;
  const { redis, config, amqp } = this;
  const key = `${UPLOAD_DATA}:${filename}`;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(data => {
      if (data.status !== STATUS_PENDING) {
        throw new HttpStatusError(412, 'upload has already been marked as finished');
      }

      const { uploadId } = data;
      const uploadKey = `${FILES_DATA}:${uploadId}`;

      // set to uploaded
      return Promise.props({
        uploadId,
        update: redis
          .pipeline()
          .hmget(uploadKey, 'status', 'parts', FILES_TAGS_FIELD, FILES_OWNER_FIELD, FILES_PUBLIC_FIELD, FILES_TEMP_FIELD)
          .hincrby(uploadKey, 'uploaded', 1)
          .hmset(key, {
            status: STATUS_UPLOADED,
            uploadedAt: Date.now(),
          })
          .exec(),
      });
    })
    .then(data => {
      const { uploadId, update } = data;
      const [parts, incr, status] = update;

      // errors
      const err = parts[0] || incr[0] || status[0];
      if (err) {
        throw err;
      }

      const [currentStatus, totalParts, tags, username, isPublic, isTemporary] = parts[1];
      const currentParts = incr[1];

      if (currentParts < totalParts) {
        throw new HttpStatusError(202, `${currentParts}/${totalParts} uploaded`);
      }

      if (currentStatus !== STATUS_PENDING) {
        throw new HttpStatusError(412, 'upload was already processed');
      }

      const uploadKey = `${FILES_DATA}:${uploadId}`;
      const pipeline = redis.pipeline();

      // update key
      pipeline.hmset(uploadKey, {
        status: STATUS_UPLOADED,
        uploadedAt: Date.now(),
      });

      // unless file is temp -> add them to index
      if (!isTemporary) {
        pipeline.persist(uploadKey);
        pipeline.sadd(FILES_INDEX, uploadId);
        pipeline.sadd(`${FILES_INDEX}:${username}`, uploadId);

        // convert 1 or undef to Boolean
        if (isPublic) {
          pipeline.sadd(FILES_INDEX_PUBLIC, uploadId);
          pipeline.sadd(`${FILES_INDEX}:${username}:pub`, uploadId);
        }

        // push to tags index
        if (tags) {
          JSON.parse(tags).forEach(tag => {
            pipeline.sadd(`${FILES_INDEX_TAGS}:${tag}`, uploadId);
          });
        }
      }

      return pipeline.exec()
        .return(uploadId);
    })
    .then(uploadId => {
      if (opts.skipProcessing) {
        return 'upload completed, proessing skipped';
      }

      const amqpConfig = config.amqp;
      const action = opts.await ? 'publishAndWait' : 'publish';
      const route = `${amqpConfig.prefix}.process`;
      return amqp[action](route, { uploadId });
    });
};
