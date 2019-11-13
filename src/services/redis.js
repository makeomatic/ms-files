const {
  FILES_INDEX_TEMP,
  FILES_DATA,
  UPLOAD_DATA,
  FILES_POST_ACTION,
  FILES_BUCKET_FIELD,
  FILES_STATUS_FIELD,
} = require('../constant');
const handlePipeline = require('../utils/pipeline-error');

class RedisManager {
  constructor(redis, config) {
    this.redis = redis;
    this.uploadTTL = config.uploadTTL;
  }

  async prepareUpload(uploadId, fileData, partsData, postAction) {
    const pipeline = this.redis.pipeline();
    const uploadKey = `${FILES_DATA}:${uploadId}`;
    const { uploadTTL } = this;

    pipeline
      .sadd(FILES_INDEX_TEMP, uploadId)
      .hmset(uploadKey, fileData)
      .expire(uploadKey, uploadTTL);

    for (const part of partsData) {
      const partKey = `${UPLOAD_DATA}:${part.filename}`;
      pipeline
        .hmset(partKey, {
          uploadId,
          [FILES_BUCKET_FIELD]: fileData[FILES_BUCKET_FIELD],
          [FILES_STATUS_FIELD]: fileData[FILES_STATUS_FIELD],
        })
        .expire(partKey, uploadTTL);
    }

    // in case we have post action provided - save it for when we complete "finish" action
    if (postAction) {
      const postActionKey = `${FILES_POST_ACTION}:${uploadId}`;
      pipeline.set(postActionKey, JSON.stringify(postAction), 'EX', uploadTTL);
    }

    return handlePipeline(await pipeline.exec());
  }
}

module.exports = RedisManager;
