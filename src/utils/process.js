const Promise = require('bluebird');
const omit = require('lodash/omit');
const stringify = require('./stringify');
const handlePipeline = require('./pipeline-error');
const { bustCache } = require('./bust-cache');
const {
  STATUS_PROCESSED,
  STATUS_PROCESSING,
  STATUS_FAILED,
  UPLOAD_DATA,
  FILES_DATA,
  FILES_EXPORT_FIELD,
  FILES_PROCESS_ERROR_FIELD,
  FILES_PROCESS_ERROR_COUNT_FIELD,
  FILE_PROCESS_IN_PROGRESS_ERROR,
  FILES_STATUS_FIELD,
  FIELDS_TO_STRINGIFY,
} = require('../constant');

const STRINGIFY_LIST = [
  ...FIELDS_TO_STRINGIFY,
  'files',
];

// blacklist of metadata that must be returned
const METADATA_BLACKLIST = [
  'location',
];

const performProcessing = async (lock, service, data) => {
  const { uploadId } = data;
  const { redis } = service;

  let response;
  try {
    const [processedData] = await service.hook('files:process:pre', data);
    await lock.extend();

    // omit location, since it's used once during upload
    const fileKeys = [];
    const files = data.files.map((file) => {
      fileKeys.push(`${UPLOAD_DATA}:${file.filename}`);
      return omit(file, METADATA_BLACKLIST);
    });

    // create new fileData
    const finalizedData = {
      ...data,
      ...processedData,
      files,
    };

    await redis.hset(`${FILES_DATA}:${uploadId}`, FILES_STATUS_FIELD, STATUS_PROCESSING);
    await lock.extend();
    await service.hook('files:process:post', finalizedData, lock);

    const serialized = Object.create(null);
    STRINGIFY_LIST.forEach((field) => {
      stringify(finalizedData, field, serialized);
    });

    const res = await redis.pipeline([
      ['hdel', `${FILES_DATA}:${uploadId}`, FILES_PROCESS_ERROR_FIELD, FILES_EXPORT_FIELD, FILES_PROCESS_ERROR_COUNT_FIELD],
      ['hmset', `${FILES_DATA}:${uploadId}`, {
        ...finalizedData,
        ...serialized,
        [FILES_STATUS_FIELD]: STATUS_PROCESSED,
      }],
      ['del', ...fileKeys],
    ]).exec();

    handlePipeline(res);

    response = {
      ...finalizedData,
      [FILES_STATUS_FIELD]: STATUS_PROCESSED,
    };
  } catch (err) {
    const res = await redis
      .pipeline([
        ['hmset', `${FILES_DATA}:${uploadId}`, {
          [FILES_STATUS_FIELD]: STATUS_FAILED,
          [FILES_PROCESS_ERROR_FIELD]: err.message,
        }],
        ['hincrby', `${FILES_DATA}:${uploadId}`, FILES_PROCESS_ERROR_COUNT_FIELD, 1],
      ])
      .exec();

    handlePipeline(res);
    throw err;
  }

  await bustCache(redis, data, true);
  return response;
};

module.exports = function processFile(key, data) {
  return Promise
    .using(this.dlock.acquireLock(`postprocess:${key}`), this, data, performProcessing)
    .catchThrow({ name: 'LockAcquisitionError' }, FILE_PROCESS_IN_PROGRESS_ERROR);
};
