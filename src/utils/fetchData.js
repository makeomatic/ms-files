const { HttpStatusError } = require('common-errors');
const { FILES_TAGS_FIELD } = require('../constant.js');
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
      const data = dataResponse[1];
      let field;

      for (field in data) {
        if (JSON_FIELDS.indexOf(field) !== -1) {
          data[field] = JSON.parse(data[field]);
        } else {
          data[field] = data[field].toString('utf8');
        }
      }

      if (!fileExists) {
        throw new HttpStatusError(404, 'could not find associated data');
      }

      return data;
    });
};
