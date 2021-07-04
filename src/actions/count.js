const { ActionTransport } = require('@microfleet/plugin-router');
const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const { FILES_USER_INDEX_KEY, FILES_USER_INDEX_PUBLIC_KEY } = require('../constant');

/**
 * Returns file count for specified user
 * @param  {Object} opts.username
 * @return {Promise}
 */
async function getFileCount({ params }) {
  const { username: owner } = params;

  const [username] = await Promise
    .bind(this, ['files:info:pre', owner])
    .spread(this.hook);

  if (!username) {
    throw new HttpStatusError(404, `User "${owner}" not found`);
  }

  const totalCount = this.redis.scard(FILES_USER_INDEX_KEY(username));
  const publicCount = this.redis.scard(FILES_USER_INDEX_PUBLIC_KEY(username));

  return Promise
    .props({ total: totalCount, public: publicCount });
}

getFileCount.transports = [ActionTransport.amqp];
module.exports = getFileCount;
