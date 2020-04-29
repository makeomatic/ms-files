const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const { v4: uuidv4 } = require('uuid');
const { HttpStatusError } = require('common-errors');
const md5 = require('md5');
const sumBy = require('lodash/sumBy');
const get = require('lodash/get');
const handlePipeline = require('../utils/pipeline-error');
// const getLock = require('../utils/acquire-lock');
const fetchData = require('../utils/fetch-data');
// const isProcessed = require('../utils/is-processed');
// const isUnlisted = require('../utils/is-unlisted');
const hasAccess = require('../utils/has-access');
// const isAliasTaken = require('../utils/is-alias-taken');
const stringify = require('../utils/stringify');
const extension = require('../utils/extension');
const isValidBackgroundOrigin = require('../utils/is-valid-background-origin');
// const { bustCache } = require('../utils/bust-cache');
const {
  STATUS_PENDING,
  STATUS_PROCESSING,
  UPLOAD_DATA,
  FILES_PUBLIC_FIELD,
  FILES_TEMP_FIELD,
  FILES_BUCKET_FIELD,
  FILES_OWNER_FIELD,
  FILES_UNLISTED_FIELD,
  FILES_STATUS_FIELD,
  FIELDS_TO_STRINGIFY,
  FILES_INDEX_TEMP,
  FILES_POST_ACTION,
  FILES_DIRECT_ONLY_FIELD,
  FILES_CONTENT_LENGTH_FIELD,
  FILES_DATA_INDEX_KEY,
} = require('../constant');

/**
 * Initiates upload
 * @param  {Object} opts
 * @param  {Object} opts.params
 * @param  {String} [opts.params.origin]
 * @param  {Array}  opts.params.files
 * @param  {Object} opts.params.meta
 * @param  {Boolean} [opts.params.directOnly=false]
 * @param  {Boolean} [opts.params.unlisted=false]
 * @param  {Boolean} [opts.params.temp=false]
 * @return {Promise}
 */
async function addMoreFiles({ params }) {
  const {
    files,
    meta,
    username,
    uploadId,
    temp,
    unlisted,
    origin,
    resumable,
    expires,
    uploadType,
    postAction,
    directOnly,
  } = params;

  const { redis, config: { uploadTTL } } = this;

  this.log.info({ params }, 'preparing upload');

  const provider = this.provider('upload', params);
  const prefix = md5(username);
  const isPublic = get(params, 'access.setPublic', false);
  const bucketName = provider.bucket.name;
  const uploadKey = FILES_DATA_INDEX_KEY(uploadId);

  await Promise
    .bind(this, ['files:upload:pre', params])
    .spread(this.hook)
    // do some extra meta validation
    .return(meta)
    .tap(isValidBackgroundOrigin)
    .return(uploadKey)
    .then(fetchData)
    .then(hasAccess(username))
    .tap(async ({ status }) => {
      if (status === STATUS_PENDING || status === STATUS_PROCESSING) {
        throw new HttpStatusError(409, 'file is being processed or upload has not been finished yet');
      }

      this.log.info({ params }, 'preprocessed upload');

      const parts = await Promise.map(files, async ({ md5Hash, type, ...rest }) => {
        // generate filename
        const filename = [
          // name
          [prefix, uploadId, uuidv4()].join('/'),
          // extension
          extension(type, rest.contentType).slice(1),
        ].join('.');

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

        // basic extension headers
        const extensionHeaders = Object.create(null);

        if (isPublic) {
          extensionHeaders['x-goog-acl'] = 'public-read';
        }

        let location;
        if (resumable) {
          location = await provider.initResumableUpload({
            filename,
            origin,
            public: isPublic,
            metadata: {
              ...metadata,
            },
          });
        } else {
          // simple upload
          location = await provider.createSignedURL({
            action: 'write',
            md5: metadata.md5Hash,
            type: metadata.contentType,
            resource: filename,
            extensionHeaders,
            expires: Date.now() + (expires * 1000),
          });
        }

        return {
          ...metadata,
          type,
          filename,
          location,
        };
      });

      const serialized = Object.create(null);
      for (const field of FIELDS_TO_STRINGIFY) {
        stringify(meta, field, serialized);
      }

      const fileData = {
        ...meta,
        ...serialized,
        uploadId,
        startedAt: Date.now(),
        files: JSON.stringify(parts),
        parts: files.length,
        [FILES_CONTENT_LENGTH_FIELD]: sumBy(parts, 'contentLength'),
        [FILES_STATUS_FIELD]: STATUS_PENDING,
        [FILES_OWNER_FIELD]: username,
        [FILES_BUCKET_FIELD]: bucketName,
      };

      if (uploadType) {
        fileData.uploadType = uploadType;
      }

      if (isPublic) {
        fileData[FILES_PUBLIC_FIELD] = 1;
      }

      if (temp) {
        fileData[FILES_TEMP_FIELD] = 1;
      }

      if (unlisted) {
        fileData[FILES_UNLISTED_FIELD] = 1;
      }

      if (directOnly) {
        fileData[FILES_DIRECT_ONLY_FIELD] = 1;
      }

      const pipeline = redis.pipeline();

      pipeline
        .sadd(FILES_INDEX_TEMP, uploadId)
        .hmset(uploadKey, fileData)
        .expire(uploadKey, uploadTTL);

      parts.forEach((part) => {
        const partKey = `${UPLOAD_DATA}:${part.filename}`;
        pipeline
          .hmset(partKey, {
            [FILES_BUCKET_FIELD]: bucketName,
            [FILES_STATUS_FIELD]: STATUS_PENDING,
            uploadId,
          })
          .expire(partKey, uploadTTL);
      });

      // in case we have post action provided - save it for when we complete "finish" action
      if (postAction) {
        const postActionKey = `${FILES_POST_ACTION}:${uploadId}`;
        pipeline.set(postActionKey, JSON.stringify(postAction), 'EX', uploadTTL);
      }

      this.log.info({ params }, 'created signed urls and preparing to save them to database');

      handlePipeline(await pipeline.exec());

      const data = {
        ...fileData,
        ...meta,
        files: parts,
      };

      await Promise
        .bind(this, ['files:upload:post', data])
        .spread(this.hook);

      return data;
    });
}

addMoreFiles.transports = [ActionTransport.amqp];
module.exports = addMoreFiles;
