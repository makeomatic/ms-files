const { HttpStatusError } = require('common-errors');
const { FIELDS_TO_STRINGIFY, FILES_TAGS_FIELD } = require('../constant.js');
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

      fields.forEach((field) => {
        const value = data[field];
        if (JSON_FIELDS.indexOf(field) !== -1) {
          data[field] = safeParse(value, []);
        } else if (FIELDS_TO_STRINGIFY.indexOf(field) !== -1) {
          data[field] = safeParse(value);
        } else {
          data[field] = value;
        }
      });

      if (!fileExists) {
        throw new HttpStatusError(404, 'could not find associated data');
      }

      return data;
    });
};
