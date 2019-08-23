const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const fsort = require('redis-filtered-sort');
const { NotImplementedError } = require('common-errors');

const handlePipeline = require('../utils/pipelineError');
const { FILES_INDEX, FILES_DATA, FILES_CONTENT_LENGTH_FIELD } = require('../constant');

const fileDataPattern = `${FILES_DATA}:*`;
const aggregateFilter = fsort.filter({
  [FILES_CONTENT_LENGTH_FIELD]: 'sum',
});

/**
 * Sorts index keys and creates linked list.
 * @param  {Redis} redis
 * @param  {string} index
 * @returns {Promise<string>}
 */
const sortIndexKeys = (redis, index) => (
  redis.fsort(index, '', '', 'DESC', '{}', Date.now(), 0, 1, 5000, true)
);

/**
 * Retrieves contentLength aggregate on a given index.
 * @param  {Redis} redis
 * @param  {string} index
 * @returns {number} Bytes.
 */
const retrieveContentLength = (redis, index, prefixLength) => (
  sortIndexKeys(redis, index)
    .then((ids) => (
      redis.fsortAggregate(ids.slice(prefixLength), fileDataPattern, aggregateFilter)
    ))
    .then(JSON.parse)
    .get(FILES_CONTENT_LENGTH_FIELD)
);

/**
 * Calculates Storage of Files per username and returns data in bytes.
 * @returns {Promise<[totalStorage: number, publicStorage: number]>}
 */
const calculateStorage = (ctx) => {
  const {
    redis, allFiles, publicFiles, prefixLength,
  } = ctx;
  return Promise.props({
    totalContentLength: retrieveContentLength(redis, allFiles, prefixLength),
    publicContentLength: retrieveContentLength(redis, publicFiles, prefixLength),
  });
};

/**
 * Retrieves Amount of Public and Private files.
 * @returns {Promise<{ total: number, public: number }>}
 */
const retrieveAmountOfFiles = (ctx) => (
  ctx
    .redis
    .pipeline()
    .scard(ctx.allFiles)
    .scard(ctx.publicFiles)
    .exec()
    .then(handlePipeline)
    .then((data) => ({
      total: data[0],
      public: data[1],
    }))
);

/**
 * Simply copy props over to accumulator obj
 * @param  {Object} map
 * @param  {Object} obj
 * @returns {Object}
 */
const remap = (map, obj) => {
  return Object.assign(map, obj);
};

/**
 * Merges data.
 * @param {Object[]} args
 * @returns {Promise<*>}
 */
function merge(args) {
  return args.reduce(remap, {});
}

/**
 * Returns amount of models on the given account.
 * @returns {Promise<{ total: number, public: number }>}
 */
async function report({ params }) {
  return Promise
    .bind(this, ['files:info:pre', params.username])
    .spread(this.hook)
    .spread((username) => {
      if (!username) {
        throw new NotImplementedError('files:info:pre hook must be specified to use this endpoint');
      }

      // redis
      const { redis, config } = this;

      const allFiles = `${FILES_INDEX}:${username}`;
      const publicFiles = `${FILES_INDEX}:${username}:pub`;
      const { includeStorage } = params;
      const prefixLength = config.redis.options.keyPrefix.length;

      const ctx = {
        redis,

        allFiles,
        publicFiles,
        prefixLength,

        username,
        includeStorage,
      };

      // include storage is somewhat costly, so we want
      // to hide it behind query
      const work = [retrieveAmountOfFiles(ctx)];
      if (includeStorage) work.push(calculateStorage(ctx));

      return Promise
        .all(work)
        .then(merge);
    });
}

report.transports = [ActionTransport.amqp];
module.exports = report;
