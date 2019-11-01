const { FILES_USR_ALIAS_PTR } = require('../constant.js');

module.exports = function resolveFilename(possibleAlias, username) {
  const hash = `${FILES_USR_ALIAS_PTR}:${username}`;
  return this.redis
    .hget(hash, possibleAlias)
    .then((filename) => filename || possibleAlias);
};
