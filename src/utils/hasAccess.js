const passThrough = require('lodash/identity');
const { HttpStatusError } = require('common-errors');
const { FILES_OWNER_FIELD } = require('../constant');

module.exports = function hasAccess(username, customError) {
  if (username == null) {
    return passThrough;
  }

  return function access(data) {
    if (data[FILES_OWNER_FIELD] !== username) {
      throw new HttpStatusError(403, customError || 'file does not belong to the provided user');
    }

    return data;
  };
};
