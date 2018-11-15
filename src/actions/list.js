const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const fsort = require('redis-filtered-sort');
const is = require('is');
const noop = require('lodash/noop');
const perf = require('ms-perf');
const fetchData = require('../utils/fetchData').batch;
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
  const {
    isPublic, temp, tags, redis,
  } = this;
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
  const {
    criteria, order, strFilter, offset, limit, expiration,
  } = this;
  return this.redis.fsort(filesIndex, `${FILES_DATA}:*`, criteria, order, strFilter, Date.now(), offset, limit, expiration);
}

/**
 * Reports missing file error
 */
function reportMissingError(err, filename) {
  this.log.fatal('failed to fetch data for %s', filename, err);
  return false;
}

/**
 * Omits errors & reports missing files
 */
function omitErrors(result, promise, idx) {
  if (promise.isFulfilled()) {
    result.push(promise.value());
  } else {
    const error = promise.reason();
    if (error.statusCode === 404) {
      reportMissingError.call(this, error, this.filenames[idx]);
    } else {
      throw error;
    }
  }

  return result;
}

/**
 * Prepares filenames
 */
const prepareFilenames = filename => `${FILES_DATA}:${filename}`;

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

  const mapped = filenames.map(prepareFilenames);
  const pipeline = Promise
    .bind(this, [mapped, this.without])
    .spread(fetchData)
    .bind({ log: this.log, filenames: mapped })
    .reduce(omitErrors, []);

  return Promise.props({ filenames, props: pipeline, length });
}

/**
 * Filters out non-truthy array elements
 */
function truthy(_, idx) {
  return !!this[idx];
}

/**
 * Prepares response
 */
function prepareResponse(data) {
  const {
    service, timer, offset, limit,
  } = this;
  const { filenames, props, length } = data;
  const filteredFilenames = filenames.filter(truthy, props);

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
async function listFiles({ params }) {
  const timer = perf('list');

  const {
    redis,
    dlock,
    log,
    config,
  } = this;

  const {
    interstoreKeyTTL,
    interstoreKeyMinTimeleft,
  } = config;

  const {
    without,
    owner,
    filter,
    public: isPublic,
    offset,
    limit,
    order,
    criteria,
    tags,
    temp,
    expiration = 30000,
  } = params;

  const strFilter = is.string(filter) ? filter : fsort.filter(filter || {});

  const ctx = {
    // context
    redis,
    dlock,
    log,
    interstoreKeyTTL,
    interstoreKeyMinTimeleft,
    timer,
    service: this,

    // our params
    without,
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
}

listFiles.transports = [ActionTransport.amqp];
module.exports = listFiles;
