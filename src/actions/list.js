const Promise = require('bluebird');
const fsort = require('redis-filtered-sort');
const is = require('is');
const noop = require('lodash/noop');
const fetchData = require('../utils/fetchData.js');
const perf = require('ms-perf');
const {
  FILES_DATA,
  FILES_INDEX,
  FILES_INDEX_PUBLIC,
  FILES_INDEX_TAGS,
  FILES_INDEX_TEMP,
  FILES_LIST,
} = require('../constant.js');

/**
 * Internal functions
 */
function interstore(username) {
  const { params, redis } = this;
  const { isPublic, temp, tags } = params;
  this.username = username;

  // choose which set to use
  let filesIndex;
  if (isPublic && username) {
    filesIndex = `${FILES_INDEX}:${username}:pub`;
  } else if (username) {
    filesIndex = `${FILES_INDEX}:${username}`;
  } else if (isPublic) {
    filesIndex = FILES_INDEX_PUBLIC;
  } else if (temp) {
    filesIndex = FILES_INDEX_TEMP;
  } else {
    filesIndex = FILES_INDEX;
  }

  if (!tags) {
    return filesIndex;
  }

  const tagKeys = [];
  let interstoreKey = `${FILES_LIST}:${filesIndex}`;

  tags.sort().forEach((tag) => {
    const tagKey = `${FILES_INDEX_TAGS}:${tag}`;
    tagKeys.push(tagKey);
    interstoreKey = `${interstoreKey}:${tagKey}`;
  });

  return redis
    .pttl(interstoreKey)
    .then((result) => {
      if (result > this.interstoreKeyMinTimeleft) {
        return interstoreKey;
      }

      return Promise.fromNode((next) => {
        this.dlock
          .push(interstoreKey, next)
          .then((completed) => {
            redis
              .pipeline()
              .sinterstore(interstoreKey, filesIndex, tagKeys)
              .expire(interstoreKey, this.interstoreKeyTTL)
              .exec()
              .return(interstoreKey)
              .asCallback(completed);

            return null;
          })
          .catch({ name: 'LockAcquisitionError' }, noop)
          .catch(err => next(err));
      });
    });
}

/**
 * Perform fetch from redis
 */
function fetchFromRedis(filesIndex) {
  const { criteria, order, strFilter, offset, limit, expiration } = this.params;
  return this.redis.fsort(filesIndex, `${FILES_DATA}:*`, criteria, order, strFilter, Date.now(), offset, limit, expiration);
}

/**
 * Is truthy?
 */
function isTruthy(file) {
  return !!file;
}

/**
 * Fetches file data
 */
function fetchFileData(filename) {
  return fetchData
    .call(this, `${FILES_DATA}:${filename}`)
    // catch missing files to avoid collisions after cache busting
    .catch({ statusCode: 404 }, (err) => {
      this.log.fatal('failed to fetch data for %s', filename, err);
      return false;
    });
}

/**
 * Fetch extra data from redis based on IDS
 */
function fetchExtraData(filenames) {
  const length = +filenames.pop();
  if (length === 0 || filenames.length === 0) {
    return {
      filenames,
      props: [],
      length,
    };
  }

  const pipeline = Promise
    .bind(this.service, filenames)
    .map(fetchFileData)
    .filter(isTruthy);

  return Promise.props({ filenames, props: pipeline, length });
}

/**
 * Prepares response
 */
function prepareResponse(data) {
  const { service, timer, offset, limit } = this;
  const { filenames, props, length } = data;
  const filteredFilenames = filenames.filter((name, idx) => !!props[idx]);

  return Promise
    .map(filteredFilenames, (filename, idx) => {
      const fileData = props[idx];
      fileData.id = filename;
      return service.hook('files:info:post', fileData).return(fileData);
    })
    .tap(timer('files:info:post'))
    .then(files => ({
      files,
      cursor: offset + limit,
      page: Math.floor(offset / limit) + 1,
      pages: Math.ceil(length / limit),
      time: timer(),
    }));
}

/**
 * List files
 * @return {Promise}
 */
module.exports = function listFiles({ params }) {
  const { redis, dlock, log, config: { interstoreKeyTTL, interstoreKeyMinTimeleft } } = this;
  const { owner, filter, public: isPublic, offset, limit, order, criteria, tags, temp, expiration = 30000 } = params;
  const strFilter = is.string(filter) ? filter : fsort.filter(filter || {});
  const timer = perf('list');

  const ctx = {
    redis,
    dlock,
    log,
    interstoreKeyTTL,
    interstoreKeyMinTimeleft,
    timer,
    service: this,
    params: {
      owner,
      filter,
      isPublic,
      offset,
      limit,
      order,
      criteria,
      tags,
      temp,
      expiration,
      strFilter,
    },
  };

  return Promise
    .bind(this, ['files:info:pre', owner])
    .spread(this.hook)
    .tap(timer('files:info:pre'))
    .bind(ctx)
    .spread(interstore)
    .tap(timer('interstore'))
    .then(fetchFromRedis)
    .tap(timer('fsort'))
    .then(fetchExtraData)
    .tap(timer('fetch'))
    .then(prepareResponse)
    .finally(timer);
};
