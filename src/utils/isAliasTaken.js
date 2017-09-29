const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const { FILES_USR_ALIAS_PTR, FILES_OWNER_FIELD } = require('../constant.js');
const identity = require('lodash/identity');

module.exports = function isAliasTaken(alias, customError) {
  // pass-through
  if (!alias) {
    return identity;
  }

  return function hasAlias(data) {
    const owner = data[FILES_OWNER_FIELD];
    const hash = `${FILES_USR_ALIAS_PTR}:${owner}`;
    return this.redis
      .hget(hash, alias)
      .then((uploadId) => {
        if (uploadId) {
          // could be predefined
          if (customError) throw customError;

          // throw conflict error
          const err = new HttpStatusError(409, `Alias already taken by ${uploadId} on user ${owner}`);
          err.data = { uploadId, owner };
          return Promise.reject(err);
        }

        return data;
      });
  };
};
