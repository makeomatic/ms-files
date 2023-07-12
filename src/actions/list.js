const { ActionTransport } = require('@microfleet/plugin-router');
const Promise = require('bluebird');
const fsort = require('redis-filtered-sort');
const perf = require('ms-perf');
const { HttpStatusError, NotImplementedError } = require('common-errors');
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
  FILES_OWNER_FIELD,
  FILES_PUBLIC_FIELD,
  FILES_DIRECT_ONLY_FIELD,
  FILES_UNLISTED_FIELD,
  FILES_TAGS_FIELD,
  FILES_UPLOADED_AT_FIELD,
  FILES_ID_FIELD,
  FILES_HAS_NFT,
  FILES_TEMP_FIELD,
  FILES_NFT_OWNER_FIELD,
  FILES_HAS_NFT_OWNER_FIELD,
  FILES_HAS_REFERENCES_FIELD,
  FILES_IS_REFERENCED_FIELD,
  FILES_PARENT_FIELD,
  FILES_NFT_TOKEN_FIELD,
  FILES_NFT_COLLECTION_FIELD,
} = require('../constant');

const k404Error = new Error('ELIST404');

/**
 * Internal functions
 */
async function interstore(ctx) {
  const { isPublic, temp, tags, redis, hasTags, uploadedAt, order, maxInterval, username, modelType } = ctx;

  if (modelType === 'nft') {
    throw new NotImplementedError('nft filter is unavailable');
  }

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
    const now = Date.now();

    // validation section to ensure we have interval that arent too large
    if (lte === '+inf' && gte === '-inf') {
      throw new HttpStatusError(400, `uploadedAt.lte & uploadedAt.gte need to have a specific interval no more than ${maxInterval} ms`);
    } else if (gte >= now) {
      throw new HttpStatusError(400, 'uploadedAt.gte needs to be in the past');
    } else if (lte === '+inf' && now - gte > maxInterval) {
      throw new HttpStatusError(400, `uploadedAt.gte needs to be greater than Now() - ${maxInterval} ms`);
    } else if (gte === '-inf') {
      throw new HttpStatusError(400, 'do not use unbound uploadedAt.lte');
    } else if (lte - gte > maxInterval) {
      throw new HttpStatusError(400, `uploadedAt.lte - uploadedAt.gte must be less than ${maxInterval}`);
    }

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
const omitPrefix = (prefix) => (filename) => filename.slice(prefix.length);

/**
 * Fetch extra data from redis based on IDS
 */
function fetchExtraData(ctx, filenames, { total, redisSearchEnabled }) {
  if (total === 0 || filenames.length === 0) {
    return {
      filenames,
      props: [],
      length: total,
    };
  }

  const transform = redisSearchEnabled
    ? omitPrefix(ctx.service.config.redis.options.keyPrefix)
    : prepareFilenames;

  const mapped = filenames.map(transform);
  const pipeline = Promise
    .bind(ctx, [mapped, { omit: ctx.without }])
    .spread(fetchData)
    .bind({ log: ctx.log, filenames: mapped })
    .reduce(omitErrors, []);

  return Promise.props({ filenames, props: pipeline, length: total });
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

const punctuation = /[,.<>{}[\]"':;!@#$%^&*()\-+=~]+/g;
const tokenization = /[\s,.<>{}[\]"':;!@#$%^&*()\-+=~]+/g;
const tagProps = [FILES_OWNER_FIELD, FILES_NFT_OWNER_FIELD, FILES_PARENT_FIELD, FILES_NFT_TOKEN_FIELD, FILES_NFT_COLLECTION_FIELD];
const numericProps = [FILES_HAS_REFERENCES_FIELD, FILES_IS_REFERENCED_FIELD];

/**
 * Performs search using redis search extension
 */
async function redisSearch(ctx) {
  // 1. build query
  const indexName = `${ctx.service.config.redis.options.keyPrefix}:files-list-v7`;
  const args = ['FT.SEARCH', indexName];
  const query = [];
  const params = [];

  if (ctx.username && ctx.modelType !== 'nft') {
    query.push(`@${FILES_OWNER_FIELD}:{ $username }`);
    params.push('username', ctx.username);
  }

  if (ctx.isPublic) {
    query.push(`@${FILES_PUBLIC_FIELD}:{1}`);
    query.push(`-@${FILES_DIRECT_ONLY_FIELD}:[1 1]`);
  }

  if (ctx.hasTags) {
    for (const [idx, tag] of ctx.tags.sort().entries()) {
      // multi-word or tags containing punctuation will be broken into pieces
      const normalizedTags = tag.replace(punctuation, ' ').split(/\s/);
      for (const [idx2, subTag] of normalizedTags.entries()) {
        const varName = `tag_${idx}_${idx2}`;
        query.push(`@${FILES_TAGS_FIELD}:$${varName}`);
        params.push(varName, subTag);
      }
    }
  }

  if (ctx.modelType) {
    query.push(`${ctx.modelType === '3d' ? '-' : ''}@${FILES_HAS_NFT}:[1 1]`);

    if (ctx.modelType === 'nft') {
      let ownerMatch = '';
      let nftOwnerMatch = '';

      if (ctx.username) {
        // owner and empty wallet
        ownerMatch = `(@${FILES_OWNER_FIELD}:{ $username } -@${FILES_HAS_NFT_OWNER_FIELD}:[1 1])`;
        params.push('username', ctx.username);
      }

      if (ctx.nftOwner) {
        // only wallet match
        nftOwnerMatch = `(@${FILES_NFT_OWNER_FIELD}:{ $nftOwner }) @${FILES_HAS_NFT_OWNER_FIELD}:[1 1]`;
        params.push('nftOwner', ctx.nftOwner);
      }

      if (ctx.username || ctx.nftOwner) {
        query.push(`(${ownerMatch}${ownerMatch && nftOwnerMatch ? '|' : ''}${nftOwnerMatch})`);
      }
    }
  }

  const { filter } = ctx;

  for (const [_propName, actionTypeOrValue] of Object.entries(filter)) {
    let propName = _propName;
    if (propName === '#') {
      propName = FILES_ID_FIELD;
    } else if (propName === '#multi') {
      propName = actionTypeOrValue.fields.join('|');
    } else if (propName === 'alias') {
      propName = 'alias_tag';
    }

    if (actionTypeOrValue === undefined || propName === 'nft') {
      // skip empty attributes
      // or nft cause it uses special index
    } else if (typeof actionTypeOrValue === 'string') {
      if (tagProps.includes(propName) || Number.isNaN(+actionTypeOrValue)) {
        query.push(`@${propName}:{ $f_${propName} }`);
        params.push(`f_${propName}`, actionTypeOrValue);
      } else {
        query.push(`@${propName}:[${actionTypeOrValue} ${actionTypeOrValue}]`);
      }
    } else if (actionTypeOrValue.gte || actionTypeOrValue.lte) {
      const lowerRange = actionTypeOrValue.gte || '-inf';
      const upperRange = actionTypeOrValue.lte || '+inf';
      query.push(`@${propName}:[${lowerRange} ${upperRange}]`);
    } else if (actionTypeOrValue.exists !== undefined) {
      if (numericProps.includes(propName)) {
        query.push(`@${propName}:[-inf +inf]`);
      } else {
        query.push(`-@${propName}:""`);
      }
    } else if (actionTypeOrValue.isempty !== undefined) {
      if (numericProps.includes(propName)) {
        query.push(`-@${propName}:[-inf +inf]`);
      } else {
        query.push(`@${propName}:""`);
      }
    } else if (actionTypeOrValue.eq) {
      query.push(`@${propName}:{ $f_${propName}_eq }`);
      params.push(`f_${propName}_eq`, actionTypeOrValue.eq);
    } else if (actionTypeOrValue.ne) {
      query.push(`-@${propName}:{ $f_${propName}_ne }`);
      params.push(`f_${propName}_ne`, actionTypeOrValue.ne);
    } else if (actionTypeOrValue.match) {
      const varName = `f_${propName.replace(/\|/g, '_')}_m`;
      const words = actionTypeOrValue.match.split(tokenization);
      const queryVars = [];

      words.forEach((word, index) => {
        if (word.trim().length === 0) {
          return;
        }

        const wordVarName = `${varName}_${index}`;
        queryVars.push(`$${wordVarName}`);
        params.push(wordVarName, word);
      });

      if (queryVars.length > 0) {
        query.push(`@${propName}:(${queryVars.join(' ')}*)`);
      }
    }
  }

  if (!ctx.temp) {
    query.push(`-@${FILES_TEMP_FIELD}:[1 1]`);
  }

  // skip unlisted files
  // NOTE: there is a bug if this appear as first in the query all models are returned instead
  query.push(`-@${FILES_UNLISTED_FIELD}:[1 1]`);

  if (query.length > 0) {
    args.push(query.join(' '));
  } else {
    args.push('*');
  }

  if (ctx.uploadedAt) {
    const lte = typeof ctx.uploadedAt.lte === 'number' ? ctx.uploadedAt.lte : '+inf';
    const gte = typeof ctx.uploadedAt.gte === 'number' ? ctx.uploadedAt.gte : '-inf';
    args.push('FILTER', FILES_UPLOADED_AT_FIELD, gte, lte);
  }

  if (params.length > 0) {
    args.push('PARAMS', params.length.toString(), ...params);
    args.push('DIALECT', '2');
  }

  // sort the response
  if (ctx.criteria) {
    args.push('SORTBY', ctx.criteria, ctx.order);
  } else {
    args.push('SORTBY', FILES_ID_FIELD, ctx.order);
  }

  // limits
  args.push('LIMIT', ctx.offset, ctx.limit);

  // we'll fetch the data later
  args.push('NOCONTENT');

  // [total, [ids]]
  ctx.service.log.info({ search: args }, 'search query');

  const [total, ...ids] = await ctx.redis.call(...args);

  return { total, ids };
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
    modelType,
    nftOwner,
    temp,
    expiration = 30000,
  } = params;

  const nonStringFilter = typeof filter === 'string' ? JSON.parse(filter) : filter;
  const { uploadedAt } = nonStringFilter;

  if (uploadedAt && !temp) {
    filter = { ...nonStringFilter, uploadedAt: undefined };
  }

  const nftFilters = {
    '3d': { nft: { isempty: '1' } },
  };

  const nftFilter = nftFilters[modelType];

  if (nftFilter) {
    filter = { ...filter, ...nftFilter };
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
    maxInterval: config.listMaxInterval,

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
    username: '',
    nftOwner,
    modelType,
  };

  try {
    const [username] = await this.hook('files:info:pre', owner);
    timer('files:info:pre');
    ctx.username = username;

    let ids;
    let total;
    if (config.redisSearch.enabled) {
      ({ total, ids } = await redisSearch(ctx));
    } else {
      const stored = await interstore(ctx);
      timer('interstore');
      ids = await fetchFromRedis(ctx, stored);
      total = +ids.pop();
      timer('fsort');
    }

    const data = await fetchExtraData(ctx, ids, { total, redisSearchEnabled: config.redisSearch.enabled });
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
