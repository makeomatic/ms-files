const { HttpStatusError } = require('common-errors');
const { FIELDS_TO_STRINGIFY, FILES_TAGS_FIELD } = require('../constant');
const safeParse = require('./safeParse');
const perf = require('ms-perf');
const handlePipelineError = require('./pipelineError');
const zipObject = require('lodash/zipObject');

/**
 * Helper constants
 */
const STRINGIFY_FIELDS = zipObject(FIELDS_TO_STRINGIFY);
const JSON_FIELDS = zipObject([FILES_TAGS_FIELD, 'files']);
const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Remaps & json-parses some of the fields
 */
function remapData(field) {
  if (this.omitFields.indexOf(field) >= 0) {
    return;
  }

  const value = this.data[field];
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
function reserializeData(fileExists, data) {
  if (!fileExists) {
    throw new HttpStatusError(404, 'could not find associated data');
  }

  const output = {};
  const fields = Object.keys(data);
  const ctx = { output, data, omitFields: this.omitFields };

  fields.forEach(remapData, ctx);

  return output;
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
    .pipeline()
    .exists(key)
    .hgetall(key)
    .exec()
    .tap(timer('redis'))
    .then(handlePipelineError)
    .tap(timer('handleError'))
    .bind({ omitFields })
    .spread(reserializeData)
    .tap(timer('remapping'))
    .finally(timer);
};
