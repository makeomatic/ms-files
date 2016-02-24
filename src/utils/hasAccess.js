const { HttpStatusError } = require('common-errors');
const { FILES_OWNER_FIELD, FILES_PUBLIC_FIELD } = require('../constant.js');

module.exports = function hasAccess(username, customError) {
  return function access(data) {
    if (username && data[FILES_OWNER_FIELD] !== username && !data[FILES_PUBLIC_FIELD]) {
      throw new HttpStatusError(403, customError || 'file does not belong to the provided user');
    }

    return data;
  };
};
