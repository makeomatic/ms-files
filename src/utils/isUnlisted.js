const { HttpStatusError } = require('common-errors');
const { FILES_UNLISTED_FIELD } = require('../constant.js');

module.exports = function isUnlisted(data) {
  if (data[FILES_UNLISTED_FIELD]) {
    throw new HttpStatusError(418, 'operation is not supported');
  }

  return data;
};
