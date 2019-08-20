const calcSlot = require('cluster-key-slot');

const { FILES_INDEX_TAGS } = require('../../constant.js');

/**
 * Return master node in case of redisCluster to be able to use
 * specific commands like `keys`. We can use usual redis instance in
 * other cases.
 */
function getRedisMasterNode(redis, config) {
  if (!config.plugins.includes('redisCluster')) {
    return redis;
  }
  const { keyPrefix } = config.redis.options;
  const slot = calcSlot(keyPrefix);
  const nodeKeys = redis.slots[slot];
  const masters = redis.connectionPool.nodes.master;

  return nodeKeys.reduce((node, key) => node || masters[key], null);
}

async function tagsToLowercase({ redis, config, log }) {
  const { keyPrefix } = config.redis.options;
  const masterNode = getRedisMasterNode(redis, config);
  const pipeline = redis.pipeline();

  return masterNode
    .keys(`${keyPrefix}${FILES_INDEX_TAGS}:*`)
    .map(key => key.replace(keyPrefix, ''))
    .forEach((key) => {
      log.info(`Rename '${key}' to '${key.toLowerCase()}'`);

      pipeline.rename(key, key.toLowerCase());
    })
    .then(() => pipeline.exec());
}

module.exports = {
  script: tagsToLowercase,
  min: 2,
  final: 3,
};
