const Promise = require('bluebird');
const sharp = require('sharp');
const uuid = require('node-uuid');
const once = require('lodash/once');
const noop = require('lodash/noop');
const fetchData = require('../utils/fetchData.js');
const { FILES_DATA, PREVIEW_PREFIX } = require('../constant.js');

// disable cache because of small stack on muslc in Alpine Linux
sharp.cache(false);

module.exports = function generatePreview(opts) {
  const { redis, config } = this;
  const { provider, transport: { cname } } = config;
  const { id: filename, size: { width, height }, format, background } = opts;
  const key = `${FILES_DATA}:${filename}`;
  const PREVIEW_POSTFIX = `${width}x${height}.${format}`;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(data => {
      const PREVIEW_FIELD = `${PREVIEW_PREFIX}${PREVIEW_POSTFIX}`;
      if (data[PREVIEW_FIELD]) {
        return `https://${cname}/${encodeURIComponent(data[PREVIEW_FIELD])}`;
      }

      return new Promise((resolve, reject) => {
        // content-length
        const { previewSize } = data;
        // specific to preview storage
        const previewStart = data.previewStart || 4;

        // acquire lock so that we don't resize it many times simulteniously
        return this.dlock
          .push(PREVIEW_FIELD, (err, previewLink) => {
            if (err) {
              return reject(err);
            }

            resolve(previewLink);
          })
          .then(_completed => {
            const completed = once(_completed);
            const previewName = `/p/${uuid.v4()}.${PREVIEW_POSTFIX}`;

            // inclusive content-range, thefore use `-1`
            const readStream = provider.readFileStream(filename, {
              start: previewStart,
              end: previewStart + previewSize - 1,
            });

            // public, cache for 1 year
            const writeStream = provider.writeStream(filename, {
              metadata: {
                contentType: `image/${format}`,
                acl: {
                  entity: 'allUsers',
                  role: 'READER',
                },
                cacheControl: 'public, max-age=31536000',
              },
              resumable: false,
            });

            // generate transformator
            const transform = sharp()
              .resize(width, height)
              .toFormat(format);

            if (background) {
              transform.background(background).embed();
            }

            readStream
              .on('error', completed)
              .pipe(transform)
              .on('error', completed)
              .pipe(writeStream)
              .on('error', completed)
              .on('finish', () => {
                // write data to redis
                redis
                  .hset(key, PREVIEW_FIELD, previewName)
                  .return(previewName)
                  .asCallback(completed);
              });
          })
          .catch(e => e.name === 'LockAcquisitionError', noop)
          .catch(reject);
      });
    });
};
