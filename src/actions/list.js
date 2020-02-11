const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const fsort = require('redis-filtered-sort');
const is = require('is');
const noop = require('lodash/noop');
const perf = require('ms-perf');
const fetchData = require('../utils/fetch-data').batch;
const {
  FILES_DATA,
  FILES_INDEX,
  FILES_INDEX_PUBLIC,
  FILES_INDEX_TAGS,
  FILES_INDEX_TEMP,
  FILES_LIST,
  FILES_USER_INDEX_KEY,
  FILES_USER_INDEX_PUBLIC_KEY,
} = require('../constant');

/**
 * Internal functions
 */
async function interstore(username) {
  const {
    isPublic, temp, tags, redis,
  } = this;
  this.username = username;

  // choose which set to use
  let filesIndex;
  if (isPublic && username) {
    filesIndex = FILES_USER_INDEX_PUBLIC_KEY(username);
  } else if (username) {
    filesIndex = FILES_USER_INDEX_KEY(username);
  } else if (isPublic) {
    filesIndex = FILES_INDEX_PUBLIC;
  } else if (temp) {
    filesIndex = FILES_INDEX_TEMP;
  } else {
    filesIndex = FILES_INDEX;
  }

  if (!Array.isArray(tags) || tags.length === 0) {
    return filesIndex;
  }

  const tagKeys = [];
  let interstoreKey = `${FILES_LIST}:${filesIndex}`;

  tags.sort().forEach((tag) => {
    const tagKey = `${FILES_INDEX_TAGS}:${tag}`;
    tagKeys.push(tagKey);
    interstoreKey = `${interstoreKey}:${tagKey}`;
  });

  const result = await redis.pttl(interstoreKey);

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
      .catch(next);
  });
}

/**
 * Perform fetch from redis
 */
async function fetchFromRedis(filesIndex) {
  const {
    redis, criteria, order, strFilter, offset, limit, expiration,
  } = this;

  // split op in 2 operations to reduce lock of redis
  const now = Date.now();
  const meta = `${FILES_DATA}:*`;

  // this splits lengthy scripts into 2 phases - getting a sorted set and then filtering
  const response = await redis.fsort(filesIndex, meta, criteria, order, '{}', now, offset, limit, expiration);
  if (strFilter === '{}') {
    return response;
  }

  return redis.fsort(filesIndex, meta, criteria, order, strFilter, now, offset, limit, expiration);
}

/**
 * Reports missing file error
 */
function reportMissingError(err, filename) {
  this.log.fatal({ err }, 'failed to fetch data for %s', filename);
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
const prepareFilenames = (filename) => `${FILES_DATA}:${filename}`;

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
async function prepareResponse(data) {
  const {
    service, timer, offset, limit,
  } = this;
  const { filenames, props, length } = data;
  const filteredFilenames = filenames.filter(truthy, props);

  const files = await Promise.map(filteredFilenames, async (filename, idx) => {
    const fileData = props[idx];
    fileData.id = filename;
    await service.hook('files:info:post', fileData);
    return fileData;
  });

  timer('files:info:post');

  return {
    files,
    cursor: offset + limit,
    page: Math.floor(offset / limit) + 1,
    pages: Math.ceil(length / limit),
    time: timer(),
  };
}

/**
 * List files
 * @return {Promise}
 */
async function listFiles({ params }) {
  const timer = perf('list', { thunk: false });

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

  try {
    const args = await this.hook('files:info:pre', owner);
    timer('files:info:pre');
    const stored = await interstore.apply(ctx, args);
    timer('interstore');
    const ids = await fetchFromRedis.call(ctx, stored);
    timer('fsort');
    const data = await fetchExtraData.call(ctx, ids);
    timer('fetch');
    return await prepareResponse.call(ctx, data);
  } finally {
    timer();
  }
}

listFiles.transports = [ActionTransport.amqp];
module.exports = listFiles;
