const Promise = require('bluebird');
const uuid = require('node-uuid');
const md5 = require('md5');
const sumBy = require('lodash/sumBy');
const get = require('lodash/get');
const stringify = require('../utils/stringify.js');
const {
  STATUS_PENDING,
  UPLOAD_DATA,
  FILES_DATA,
  FILES_PUBLIC_FIELD,
  FILES_TEMP_FIELD,
  FILES_BUCKET_FIELD,
  FILES_OWNER_FIELD,
  FILES_UNLISTED_FIELD,
  FILES_STATUS_FIELD,
  FIELDS_TO_STRINGIFY,
  FILES_INDEX_TEMP,
  TYPE_MAP,
} = require('../constant.js');

function typeToExtension(type) {
  return TYPE_MAP[type] || '.bin';
}

/**
 * Initiates upload
 * @param  {Object} opts
 * @param  {Object} opts.params
 * @param  {Array}  opts.params.files
 * @param  {Object} opts.params.meta
 * @return {Promise}
 */
module.exports = function initFileUpload({ params }) {
  const { files, meta, username, temp, unlisted } = params;
  const { redis, config: { uploadTTL } } = this;

  const provider = this.provider('upload', params);
  const prefix = md5(username);
  const uploadId = uuid.v4();
  const isPublic = get(params, 'access.setPublic', false);
  const bucketName = provider.bucket.name;

  return Promise
    .bind(this, ['files:upload:pre', params])
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
      const serialized = {};
      FIELDS_TO_STRINGIFY.forEach(field => {
        stringify(meta, field, serialized);
      });

      const fileData = {
        ...meta,
        ...serialized,
        uploadId,
        startedAt: Date.now(),
        files: JSON.stringify(parts),
        contentLength: sumBy(parts, 'contentLength'),
        parts: files.length,
        [FILES_STATUS_FIELD]: STATUS_PENDING,
        [FILES_OWNER_FIELD]: username,
        [FILES_BUCKET_FIELD]: bucketName,
      };

      if (isPublic) {
        fileData[FILES_PUBLIC_FIELD] = 1;
      }

      if (temp) {
        fileData[FILES_TEMP_FIELD] = 1;
      }

      if (unlisted) {
        fileData[FILES_UNLISTED_FIELD] = 1;
      }

      const pipeline = redis.pipeline();
      const uploadKey = `${FILES_DATA}:${uploadId}`;

      pipeline
        .sadd(FILES_INDEX_TEMP, uploadId)
        .hmset(uploadKey, fileData)
        .expire(uploadKey, uploadTTL);

      parts.forEach(part => {
        const partKey = `${UPLOAD_DATA}:${part.filename}`;
        pipeline
          .hmset(partKey, { [FILES_STATUS_FIELD]: STATUS_PENDING, uploadId })
          .expire(partKey, uploadTTL);
      });

      return pipeline
        .exec()
        .return({
          ...fileData,
          ...meta,
          files: parts,
        });
    })
    .tap(data => this.hook.call(this, 'files:upload:post', data));
};
