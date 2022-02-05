/**
 * @typedef { import('ioredis') } Redis
 * @typedef { import('ioredis').Cluster } RedisCluster
 * @typedef { import('@microfleet/core-types').Microfleet } Microfleet
 * @typedef { import('@microfleet/plugin-redis-cluster') }
 */
const calcSlot = require('cluster-key-slot');

/**
 * Return master node in case of redisCluster to be able to use
 * specific commands like `keys`. We can use usual redis instance in
 * other cases.
 *
 * @param {Redis | RedisCluster} redis
 * @param {Microfleet} micro
 * @returns {Redis}
 */
function getRedisMasterNode(redis, micro) {
  if (micro.redisType !== 'redisCluster') {
    return redis;
  }
  const { keyPrefix } = micro.config.redis.options;
  const slot = calcSlot(keyPrefix);
  const nodeKeys = redis.slots[slot];
  const masters = redis.connectionPool.nodes.master;

  return nodeKeys.reduce((node, key) => node || masters[key], null);
}

module.exports = { getRedisMasterNode };
