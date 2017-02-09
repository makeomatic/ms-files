const { FILES_USR_ALIAS_PTR } = require('../constant.js');

function headAction({ params }) {
  const { aliases, username } = params;
  const hash = `${FILES_USR_ALIAS_PTR}:${username}`;

  return this.redis.hmget(hash, aliases);
}

module.exports = headAction;
