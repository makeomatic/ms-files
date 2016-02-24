const uuid = require('node-uuid');
const url = require('url');
const md5 = require('md5');
const { STATUS_PENDING, UPLOAD_DATA } = require('../constant.js');

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
  const fileId = uuid.v4();
  const filename = id ? `${md5(id)}/${fileId}` : fileId;
  const metadata = {
    contentType,
    contentLength,
    md5Hash: new Buffer(md5Hash, 'hex').toString('base64'),
    owner: id,
  };

  if (name) {
    metadata.humanName = name;
  }

  return provider.initResumableUpload({
    filename,
    metadata,
  })
  .then(location => {
    // https://www.googleapis.com/upload/storage/v1/b/myBucket/o?uploadType=resumable&upload_id=xa298sd_sdlkj2
    const uri = url.parse(location, true);
    const uploadId = uri.query.upload_id;
    const startedAt = Date.now();
    const fileData = {
      uploadId,
      location,
      filename,
      startedAt,
      status: STATUS_PENDING,
      ...metadata,
      md5Hash,
    };

    // until file is uploaded, it won't appear in the lists and will be cleaned up
    // in case the upload is never finished
    return redis
      .pipeline()
      .hmset(`${UPLOAD_DATA}:${uploadId}`, fileData)
      .expire(`${UPLOAD_DATA}:${uploadId}`, 86400)
      .exec()
      .return(fileData);
  });
};
