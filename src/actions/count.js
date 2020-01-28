const { ActionTransport } = require('@microfleet/core');
const assert = require('assert');
const Promise = require('bluebird');
const { NotFoundError } = require('common-errors');
const { FILES_INDEX } = require('../constant');

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

  assert(username, new NotFoundError(`User "${owner}" not found`));

  const totalCount = this.redis.scard(`${FILES_INDEX}:${username}`);
  const publicCount = this.redis.scard(`${FILES_INDEX}:${username}:pub`);

  return Promise
    .props({ total: totalCount, public: publicCount });
}

getFileCount.transports = [ActionTransport.amqp];
module.exports = getFileCount;
