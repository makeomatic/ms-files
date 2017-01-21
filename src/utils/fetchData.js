const { HttpStatusError } = require('common-errors');
const { FIELDS_TO_STRINGIFY, FILES_TAGS_FIELD } = require('../constant');
const safeParse = require('./safeParse');
const perf = require('ms-perf');
const handlePipelineError = require('./pipelineError');
const zipObject = require('lodash/zipObject');

const STRINGIFY_FIELDS = zipObject(FIELDS_TO_STRINGIFY);
const JSON_FIELDS = zipObject([FILES_TAGS_FIELD, 'files']);
const hasOwnProperty = Object.prototype.hasOwnProperty;

module.exports = function fetchData(key, omitFields = []) {
  const { redis } = this;
  const timer = perf('fetchData');

  return redis
    .pipeline()
    .exists(key)
    .hgetall(key)
    .exec()
    .tap(timer('redis'))
    .then(handlePipelineError)
    .tap(timer('handleError'))
    .spread((fileExists, data) => {
      if (!fileExists) {
        throw new HttpStatusError(404, 'could not find associated data');
      }

      const output = {};
      const fields = Object.keys(data);

      fields.forEach((field) => {
        if (omitFields.indexOf(field) >= 0) {
          return;
        }

        const value = data[field];
        if (hasOwnProperty.call(JSON_FIELDS, field)) {
          output[field] = safeParse(value, []);
        } else if (hasOwnProperty.call(STRINGIFY_FIELDS, field)) {
          output[field] = safeParse(value);
        } else {
          output[field] = value;
        }
      });

      return output;
    })
    .tap(timer('remapping'))
    .finally(timer);
};
