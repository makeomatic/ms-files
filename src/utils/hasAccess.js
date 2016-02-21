const { HttpStatusError } = require('common-errors');
const Promise = require('bluebird');
const { FILES_OWNER_FIELD } = require('../constant.js');

module.exports = function hasAccess(username, customError) {
  return function access(data) {
    if (username && data[FILES_OWNER_FIELD] !== username) {
      return Promise.reject(
        new HttpStatusError(403, customError || 'file does not belong to the provided user')
      );
    }

    return Promise.resolve(data);
  };
};
