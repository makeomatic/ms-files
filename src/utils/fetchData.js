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
    .hgetall(key)
    .exec()
    .spread((fileExistsResponse, dataResponse) => {
      const fileExists = fileExistsResponse[1];
      const data = dataResponse[1];
      const fields = Object.keys(data);

      fields.forEach(field => {
        const value = data[field];
        if (JSON_FIELDS.indexOf(field) !== -1) {
          data[field] = safeParse(value, []);
        } else {
          data[field] = value.toString('utf8');
        }
      });

      if (!fileExists) {
        throw new HttpStatusError(404, 'could not find associated data');
      }

      return data;
    });
};
