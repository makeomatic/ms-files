const Promise = require('bluebird');
const perf = require('ms-perf');
const zipObject = require('lodash/zipObject');
const debug = require('debug')('ms-files:fetchData');
const calcSlot = require('cluster-key-slot');
const fs = require('fs');
const is = require('is');
const safeParse = require('./safeParse');
const { FIELDS_TO_STRINGIFY, FILES_TAGS_FIELD, FILE_MISSING_ERROR } = require('../constant');

/**
 * Helper constants
 */
const fetchDataScript = fs.readFileSync(`${__dirname}/../../lua/fetchData.lua`, 'utf8');
const missingError = e => /404/.test(e.message);
const STRINGIFY_FIELDS = zipObject(FIELDS_TO_STRINGIFY);
const JSON_FIELDS = zipObject([FILES_TAGS_FIELD, 'files']);
const { hasOwnProperty } = Object.prototype;

/**
 * Remaps & json-parses some of the fields
 */
function remapData(field, index) {
  const value = this.data[index];
  if (hasOwnProperty.call(JSON_FIELDS, field)) {
    this.output[field] = safeParse(value, []);
  } else if (hasOwnProperty.call(STRINGIFY_FIELDS, field)) {
    this.output[field] = safeParse(value);
  } else {
    this.output[field] = value;
  }
}

/**
 * Checks error & remaps data
 */
function reserializeData(fields, data) {
  debug('reserialize', fields, data);
  const output = {};
  fields.forEach(remapData, { output, data });
  return output;
}

/**
 * Queues more requests to pipeline
 */
function addToPipeline(key) {
  this.pipeline.fetchData(1, key, this.omitFields);
}

/**
 * Deserializes redis pipeline into many responses
 */
function deserializePipeline(response) {
  const [error, data] = response;

  // if we have an error - means file is missing, just reject
  if (error) {
    if (missingError(error)) {
      return Promise.reject(error).reflect();
    }

    throw error;
  }

  // data[0] -> fields
  // data[1] -> values
  return Promise.resolve(reserializeData(data[0], data[1])).reflect();
}

async function selectMaster(redis) {
  // this must include {}
  const prefix = redis.options.keyPrefix;
  const slot = calcSlot(prefix);
  // they will all refer to the same slot, because we prefix with {}
  // this has possibility of throwing, but not likely to since previous operations
  // would've been rejected already, in a promise this will result in a rejection
  const nodeKeys = redis.slots[slot];
  const masters = redis.connectionPool.nodes.master;
  const masterNode = nodeKeys.reduce((node, key) => node || masters[key], null);

  // if we have no master - delay the request by 100ms
  if (masterNode == null) {
    return Promise.delay(100).return(redis).then(selectMaster);
  }

  // uses internal implementation details
  if (is.fn(masterNode.fetchData) !== true) {
    masterNode.options.keyPrefix = prefix;
    masterNode.defineCommand('fetchData', { lua: fetchDataScript });
    masterNode.options.keyPrefix = null;
  }

  return masterNode;
}

/**
 * Fetches data
 * @param  {String} key
 * @param  {Array}  [omitFields=[]]
 */
module.exports = function fetchData(key, omitFields = []) {
  const { redis } = this;
  const timer = perf(`fetchData:${key}`);

  return redis
    .fetchData(1, key, omitFields)
    .tap(timer('redis'))
    .catchThrow(missingError, FILE_MISSING_ERROR)
    .spread(reserializeData)
    .tap(timer('remapping'))
    .finally(timer);
};

module.exports.batch = async function fetchDataBatch(keys, omitFields = []) {
  const timer = perf('fetchData:batch');
  const { redis, service: { redisType } } = this;

  const masterNode = redisType === 'redisCluster'
    ? await selectMaster(redis)
    : redis;

  const pipeline = masterNode.pipeline();
  keys.forEach(addToPipeline, { pipeline, omitFields });

  try {
    const data = await pipeline.exec();
    timer('pipeline')();
    return await Promise.map(data, deserializePipeline);
  } finally {
    timer();
  }
};
