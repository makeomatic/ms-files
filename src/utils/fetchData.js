const { HttpStatusError } = require('common-errors');
const { FILES_TAGS_FIELD } = require('../constant.js');
const mapValues = require('lodash/mapValues');
const safeParse = require('./safeParse.js');
const JSON_FIELDS = [FILES_TAGS_FIELD, 'files'];

module.exports = function exists(key) {
  const { redis } = this;
  return redis
    .pipeline()
    .exists(key)
    .hgetallBuffer(key)
    .exec()
    .spread((fileExistsResponse, dataResponse) => {
      const fileExists = fileExistsResponse[1];
      const data = mapValues(dataResponse[1], (value, field) => (
        JSON_FIELDS.indexOf(field) !== -1 ? safeParse(value, []) : value.toString('utf8')
      ));

      if (!fileExists) {
        throw new HttpStatusError(404, 'could not find associated data');
      }

      return data;
    });
};
