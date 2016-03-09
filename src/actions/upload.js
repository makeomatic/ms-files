const Promise = require('bluebird');
const uuid = require('node-uuid');
const md5 = require('md5');
const sumBy = require('lodash/sumBy');
const { STATUS_PENDING, UPLOAD_DATA, FILES_DATA } = require('../constant.js');

const TYPE_MAP = {
  'c-bin': '.bin.gz',
  'c-texture': '.jpeg',
  'c-preview': '.jpeg',
};

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
  const { files, meta, username } = opts;
  const { provider, redis } = this;
  const prefix = md5(username);
  const uploadId = uuid.v4();

  return Promise
    .bind(this, ['files:upload:pre', files, username])
    // extra input validation
    .spread(this.postHook).get(0)
    // init uploads
    .map(function initResumableUpload({ md5Hash, type, ...rest }) {
      const filename = `${prefix}/${uploadId}/${uuid.v4()}${typeToExtension(type)}`;
      const metadata = {
        ...rest,
        md5Hash: new Buffer(md5Hash, 'hex').toString('base64'),
      };

      return Promise.props({
        ...metadata,
        type,
        filename,
        location: provider.initResumableUpload({ filename, metadata }),
      });
    })
    .then(parts => {
      const fileData = {
        ...meta,
        uploadId,
        owner: username,
        startedAt: Date.now(),
        files: JSON.stringify(parts),
        contentLength: sumBy(parts, 'contentLength'),
        status: STATUS_PENDING,
        parts: files.length,
      };

      const pipeline = redis.pipeline();
      const uploadKey = `${FILES_DATA}:${uploadId}`;

      pipeline
        .hmset(uploadKey, fileData)
        .expire(uploadKey, 86400);

      parts.forEach(part => {
        const partKey = `${UPLOAD_DATA}:${part.filename}`;
        pipeline
          .hmset(partKey, { status: STATUS_PENDING, uploadId })
          .expire(partKey, 86400);
      });

      return pipeline
        .exec()
        .return({ ...fileData, files: parts });
    });
};
