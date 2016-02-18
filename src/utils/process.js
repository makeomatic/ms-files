const { STATUS_PROCESSED } = require('../constant.js');

module.exports = function processFile(key, data) {
  const { _config: config, redis, provider, dlock } = this;

  return dlock
    .once(`postprocess:${key}`)
    .then(lock => {
      return config.process(provider, { key, data, redis })
        .tap(() => {
          return redis.hset(key, 'status', STATUS_PROCESSED);
        })
        .finally(() => {
          return lock.release();
        });
    });
};
