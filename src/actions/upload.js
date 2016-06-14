const Promise = require('bluebird');
const uuid = require('node-uuid');
const md5 = require('md5');
const sumBy = require('lodash/sumBy');
const get = require('lodash/get');
const {
  STATUS_PENDING,
  UPLOAD_DATA,
  FILES_DATA,
  FILES_PUBLIC_FIELD,
  FILES_TAGS_FIELD,
  FILES_TEMP_FIELD,
  FILES_BUCKET_FIELD,
  FILES_OWNER_FIELD,
  TYPE_MAP,
} = require('../constant.js');

function typeToExtension(type) {
  return TYPE_MAP[type] || '.bin';
}

/**
 * Initiates upload
 * @param  {Object} opts
 * @param  {Array}  opts.files
 * @param  {Object} opts.meta
 * @return {Promise}
 */
module.exports = function initFileUpload(opts) {
  const { files, meta, username, temp } = opts;
  const { redis, config: { uploadTTL } } = this;

  const provider = this.provider('upload', opts);
  const prefix = md5(username);
  const uploadId = uuid.v4();
  const isPublic = get(opts, 'access.setPublic', false);
  const bucketName = provider.bucket.name;

  return Promise
    .bind(this, ['files:upload:pre', opts])
    .spread(this.hook)
    .return(files)
    .map(function initResumableUpload({ md5Hash, type, ...rest }) {
      const filename = `${prefix}/${uploadId}/${uuid.v4()}${typeToExtension(type)}`;
      const metadata = {
        ...rest,
        md5Hash: Buffer.from(md5Hash, 'hex').toString('base64'),
        [FILES_BUCKET_FIELD]: bucketName,
      };

      // this is an override, because safari has a bug:
      // it doesn't decode gzip encoding when contentType is not one of
      // it's supported ones
      if (type === 'c-bin') {
        metadata.contentType = 'text/plain';
      }

      return Promise.props({
        ...metadata,
        type,
        filename,
        location: provider.initResumableUpload({
          filename,
          predefinedAcl: isPublic ? 'publicRead' : '',
          metadata: {
            ...metadata,
          },
        }),
      });
    })
    .then(parts => {
      if (meta[FILES_TAGS_FIELD]) {
        meta[FILES_TAGS_FIELD] = JSON.stringify(meta[FILES_TAGS_FIELD]);
      }

      const fileData = {
        ...meta,
        uploadId,
        startedAt: Date.now(),
        files: JSON.stringify(parts),
        contentLength: sumBy(parts, 'contentLength'),
        status: STATUS_PENDING,
        parts: files.length,
        [FILES_OWNER_FIELD]: username,
        [FILES_BUCKET_FIELD]: bucketName,
      };

      if (isPublic) {
        fileData[FILES_PUBLIC_FIELD] = 1;
      }

      if (temp) {
        fileData[FILES_TEMP_FIELD] = 1;
      }

      const pipeline = redis.pipeline();
      const uploadKey = `${FILES_DATA}:${uploadId}`;

      pipeline
        .hmset(uploadKey, fileData)
        .expire(uploadKey, uploadTTL);

      parts.forEach(part => {
        const partKey = `${UPLOAD_DATA}:${part.filename}`;
        pipeline
          .hmset(partKey, { status: STATUS_PENDING, uploadId })
          .expire(partKey, uploadTTL);
      });

      return pipeline
        .exec()
        .return({ ...fileData, files: parts });
    })
    .tap(data => this.hook.call(this, 'files:upload:post', data));
};
