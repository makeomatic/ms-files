const { getRedisMasterNode } = require('../../utils/get-redis-master-node');
const { FILES_INDEX_TAGS } = require('../../constant');

async function tagsToLowercase(service) {
  const { redis, config, log } = service;
  const { keyPrefix } = config.redis.options;
  const masterNode = getRedisMasterNode(redis, service);
  const pipeline = redis.pipeline();

  return masterNode
    .keys(`${keyPrefix}${FILES_INDEX_TAGS}:*`)
    .map((key) => key.replace(keyPrefix, ''))
    .each((brokenKey) => {
      const fixedKey = brokenKey.toLowerCase();

      if (brokenKey === fixedKey) {
        return;
      }

      log.info(`Union '${fixedKey}' and '${brokenKey}'`);

      // a lowercase key could already exist
      pipeline.sunionstore(fixedKey, fixedKey, brokenKey);
      pipeline.del(brokenKey);
    })
    .then(() => pipeline.exec());
}

module.exports = {
  script: tagsToLowercase,
  min: 2,
  final: 3,
};
