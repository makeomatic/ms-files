const uuid = require('node-uuid');

/**
 * Initiates upload
 * @param  {Object} opts
 * @param  {String} opts.contentType
 * @param  {String} opts.md5Hash
 * @param  {Number} opts.contentLength
 * @param  {String} opts.id
 * @return {Promise}
 */
module.exports = function initFileUpload(opts) {
  const { contentType, md5Hash, contentLength, id } = opts;
  const { provider, redis } = this;
  const filename = uuid.v4();
  const metadata = {
    contentType,
    contentLength,
    md5Hash,
    owner: id,
  };

  return provider.initResumableUpload({
    filename,
    generation: 1,
    metadata,
  })
  .then(uploadId => {
    const pipeline = redis.pipeline();
    const startedAt = Date.now();
    const fileData = { uploadId, filename, owner: id, startedAt, status: 'pending' };

    pipeline.sadd('files-index', filename);
    pipeline.hmset(`files-data:${filename}`, Object.assign({ uploadId, startedAt, status: 'pending' }, metadata));
    pipeline.hmset(`upload-data:${uploadId}`, fileData);

    if (id) {
      pipeline.sadd(`files-index:${id}`, filename);
    }

    return pipeline.exec().return(fileData);
  });
};
