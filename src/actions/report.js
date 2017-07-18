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
 * Retrieves contentLength aggregate on a given index.
 * @param  {Redis} redis
 * @param  {string} index
 * @returns {number} Bytes.
 */
const retrieveContentLength = (redis, index) => {
  return redis
    .fsortAggregate(index, fileDataPattern, aggregateFilter)
    .then(JSON.parse)
    .get(FILES_CONTENT_LENGTH_FIELD);
};

/**
 * Calculates Storage of Files per username and returns data in bytes.
 * @returns {Promise<[totalStorage: number, publicStorage: number]>}
 */
function calculateStorage() {
  const { redis, allFiles, publicFiles } = this;
  return Promise.props({
    totalContentLength: retrieveContentLength(redis, allFiles),
    publicContentLength: retrieveContentLength(redis, publicFiles),
  });
}

/**
 * Retrieves Amount of Public and Private files.
 * @returns {Promise<{ total: number, public: number }>}
 */
function retrieveAmountOfFiles() {
  return this
    .redis
    .pipeline()
    .scard(this.allFiles)
    .scard(this.publicFiles)
    .exec()
    .then(handlePipeline)
    .then(data => ({
      total: data[0],
      public: data[1],
    }));
}

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
module.exports = function listFiles({ params }) {
  const { redis } = this;

  return Promise
    .bind(this, ['files:info:pre', params.username])
    .spread(this.hook)
    .spread((username) => {
      if (!username) {
        throw new NotImplementedError('files:info:pre hook must be specified to use this endpoint');
      }

      const allFiles = `${FILES_INDEX}:${username}`;
      const publicFiles = `${FILES_INDEX}:${username}:pub`;
      const includeStorage = params.includeStorage;

      const ctx = {
        redis,

        allFiles,
        publicFiles,

        username,
        includeStorage,
      };

      // include storage is somewhat costly, so we want
      // to hide it behind query
      const work = [retrieveAmountOfFiles];
      if (includeStorage) work.push(calculateStorage);

      return Promise
        .bind(ctx, work)
        .all()
        .then(merge);
    });
};
