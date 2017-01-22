const { FIELDS_TO_STRINGIFY, FILES_TAGS_FIELD, FILE_MISSING_ERROR } = require('../constant');
const safeParse = require('./safeParse');
const perf = require('ms-perf');
const zipObject = require('lodash/zipObject');

/**
 * Helper constants
 */
const missingError = e => /404/.test(e.message);
const STRINGIFY_FIELDS = zipObject(FIELDS_TO_STRINGIFY);
const JSON_FIELDS = zipObject([FILES_TAGS_FIELD, 'files']);
const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Remaps & json-parses some of the fields
 */
function remapData(field) {
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
function reserializeData(fields, data) {
  const output = {};
  fields.forEach(remapData, { output, data });
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
    .fetchData(1, key, omitFields)
    .tap(timer('redis'))
    .catchThrow(missingError, FILE_MISSING_ERROR)
    .spread(reserializeData)
    .tap(timer('remapping'))
    .finally(timer);
};
