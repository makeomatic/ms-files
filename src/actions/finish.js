const Errors = require('common-errors');

/**
 * Finish upload
 * @param  {Object} opts.id
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function completeFileUpload(opts) {
  const { redis, provider, config, amqp } = this;
  const { id, username } = opts;
  const key = `upload-data:${id}`;

  return redis
    .pipeline()
    .exists(key)
    .hgetall(key)
    .exec()
    .spread((exists, data) => {
      if (!exists) {
        throw new Errors.HttpStatusError(404, 'could not find associated upload data');
      }

      if (username && data.owner !== username) {
        throw new Errors.HttpStatusError(403, 'upload does not belong to the provided user');
      }

      if (data.status !== 'pending') {
        throw new Errors.HttpStatusError(412, 'upload has already been marked as finished');
      }

      const { filename } = data;

      return provider.exists(filename)
        .then(fileExists => {
          if (!fileExists) {
            throw new Errors.HttpStatusError(404, 'could not find associated upload data');
          }

          const pipeline = redis.pipeline();
          const fileData = Object.assign({}, data, { status: 'uploaded' });

          pipeline.sadd('files-index', filename);
          pipeline.hmset(`files-data:${filename}`, fileData);
          pipeline.del(key);

          if (username) {
            pipeline.sadd(`files-index:${username}`, filename);
          }

          return pipeline.exec().return(fileData);
        });
    })
    .tap(fileData => {
      const amqpConfig = config.amqp;
      return amqp.publish(`${amqpConfig.prefix}.${amqpConfig.postfix.process}`, { filename: fileData.filename, username });
    });
};
