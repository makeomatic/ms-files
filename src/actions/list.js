const { ActionTransport } = require('@microfleet/plugin-router');
const Promise = require('bluebird');
const fsort = require('redis-filtered-sort');
const perf = require('ms-perf');
const handlePipeline = require('../utils/pipeline-error');
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
  FILES_INDEX_UAT,
  FILES_INDEX_UAT_PUBLIC,
  FILES_USER_INDEX_UAT_KEY,
  FILES_USER_INDEX_UAT_PUBLIC_KEY,
} = require('../constant');

const k404Error = new Error('ELIST404');

/**
 * Internal functions
 */
async function interstore(ctx, username) {
  const { isPublic, temp, tags, redis, hasTags, uploadedAt, order } = ctx;
  ctx.username = username;

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

  let uploadedAtIndex;
  let uploadedAtIndexInterstore;
  let uploadedAtRequest;
  if (uploadedAt) {
    if (isPublic && username) {
      uploadedAtIndex = FILES_USER_INDEX_UAT_PUBLIC_KEY(username);
    } else if (username) {
      uploadedAtIndex = FILES_USER_INDEX_UAT_KEY(username);
    } else if (isPublic) {
      uploadedAtIndex = FILES_INDEX_UAT_PUBLIC;
    } else {
      uploadedAtIndex = FILES_INDEX_UAT;
    }

    const lte = typeof uploadedAt.lte === 'number' ? uploadedAt.lte : '+inf';
    const gte = typeof uploadedAt.gte === 'number' ? uploadedAt.gte : '-inf';
    uploadedAtRequest = order === 'DESC'
      ? ['zrevrangebyscore', uploadedAtIndex, lte, gte]
      : ['zrangebyscore', uploadedAtIndex, gte, lte];
    uploadedAtIndexInterstore = `${uploadedAtIndex}!${order}!${lte}!${gte}`;
  }

  if (!hasTags && !uploadedAtIndex) {
    return filesIndex;
  }

  let interstoreKey = `${FILES_LIST}:${filesIndex}`;
  const tagKeys = [];

  if (hasTags) {
    for (const tag of tags.sort().values()) {
      const tagKey = `${FILES_INDEX_TAGS}:${tag}`;
      tagKeys.push(tagKey);
      interstoreKey = `${interstoreKey}:${tagKey}`;
    }
  }

  if (uploadedAtIndex) {
    interstoreKey = `${interstoreKey}:${uploadedAtIndexInterstore}`;
    tagKeys.push(uploadedAtIndexInterstore);
  }

  const result = await redis.pttl(interstoreKey);
  if (result > ctx.interstoreKeyMinTimeleft) {
    return interstoreKey;
  }

  // convert zset -> set
  if (uploadedAtIndexInterstore) {
    await ctx.dlock.manager.fanout(uploadedAtIndexInterstore, async () => {
      const ttl = await redis.pttl(uploadedAtIndexInterstore);
      if (ttl > ctx.interstoreKeyMinTimeleft) {
        return uploadedAtIndexInterstore;
      }

      const [cmd, ...args] = uploadedAtRequest;
      const ids = await redis[cmd](...args);

      if (ids.length === 0) {
        throw k404Error;
      }

      const res = await redis
        .pipeline()
        .sadd(uploadedAtIndexInterstore, ids)
        .expire(uploadedAtIndexInterstore, ctx.interstoreKeyTTL)
        .exec();

      handlePipeline(res);
      return uploadedAtIndexInterstore;
    });
  }

  // ensure we only do 1 operation concurrently
  await ctx.dlock.manager.fanout(interstoreKey, async () => {
    const res = await redis.pipeline()
      .sinterstore(interstoreKey, filesIndex, tagKeys)
      .expire(interstoreKey, ctx.interstoreKeyTTL)
      .exec();

    handlePipeline(res);
  });

  return interstoreKey;
}

/**
 * Perform fetch from redis
 */
async function fetchFromRedis(ctx, filesIndex) {
  const {
    redis,
    criteria,
    order,
    strFilter,
    offset,
    limit,
    expiration,
    hasTags,
    avoidTagCache,
  } = ctx;

  // split op in 2 operations to reduce lock of redis
  const now = Date.now();
  const meta = `${FILES_DATA}:*`;

  // caches for 1 second when there are tags
  if (hasTags && avoidTagCache) {
    return redis.fsort(filesIndex, meta, criteria, order, strFilter, now, offset, limit, 1000); // cache for 1 second
  }

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
function fetchExtraData(ctx, filenames) {
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
    .bind(ctx, [mapped, { omit: ctx.without }])
    .spread(fetchData)
    .bind({ log: ctx.log, filenames: mapped })
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
async function prepareResponse(ctx, data) {
  const { service, timer, offset, limit } = ctx;
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
    avoidTagCache,
  } = config;

  let {
    filter = Object.create(null),
  } = params;

  const {
    without,
    owner,
    public: isPublic,
    offset,
    limit,
    order,
    criteria,
    tags,
    temp,
    expiration = 30000,
  } = params;

  const nonStringFilter = typeof filter === 'string' ? JSON.parse(filter) : filter;
  const { uploadedAt } = nonStringFilter;

  if (uploadedAt && !temp) {
    filter = { ...nonStringFilter, uploadedAt: undefined };
  }

  const strFilter = typeof filter === 'string'
    ? filter
    : fsort.filter(filter);

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
    uploadedAt: temp ? null : uploadedAt,
    hasTags: Array.isArray(tags) && tags.length > 0,
    avoidTagCache,
  };

  try {
    const [username] = await this.hook('files:info:pre', owner);
    timer('files:info:pre');
    const stored = await interstore(ctx, username);
    timer('interstore');
    const ids = await fetchFromRedis(ctx, stored);
    timer('fsort');
    const data = await fetchExtraData(ctx, ids);
    timer('fetch');
    return await prepareResponse(ctx, data);
  } catch (e) {
    if (e.message === k404Error.message) {
      return {
        files: [],
        cursor: 0,
        page: 0,
        pages: 0,
        time: timer(),
      };
    }

    this.log.warn({ timer: timer(), err: e }, 'list search failed');
    throw e;
  }
}

listFiles.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = listFiles;
