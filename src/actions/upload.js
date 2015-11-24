const uuid = require('node-uuid');
const url = require('url');

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
  const { contentType, md5Hash, contentLength, id, name } = opts;
  const { provider, redis } = this;
  const filename = id ? id + '/' + uuid.v4() : uuid.v4();
  const metadata = {
    contentType,
    contentLength,
    md5Hash,
    owner: id,
  };

  if (name) {
    metadata.name = name;
  }

  return provider.initResumableUpload({
    filename,
    generation: 1,
    metadata,
  })
  .then(location => {
    // https://www.googleapis.com/upload/storage/v1/b/myBucket/o?uploadType=resumable&upload_id=xa298sd_sdlkj2
    const uri = url.parse(location, true);
    const uploadId = uri.query.upload_ud;
    const startedAt = Date.now();
    const fileData = Object.assign({ uploadId, location, filename, startedAt, status: 'pending' }, metadata);

    // until file is uploaded, it won't appear in the lists and will be cleaned up
    // in case the upload is never finished
    return redis
      .pipeline()
      .hmset(`upload-data:${uploadId}`, fileData)
      .expire(`upload-data:${uploadId}`, 86400)
      .exec()
      .return(fileData);
  });
};
