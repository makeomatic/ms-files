const { HttpStatusError } = require('common-errors');
const { STATUS_UPLOADED, STATUS_PENDING } = require('../constant.js');

/**
 * Finish upload
 * @param  {Object} opts.id
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function completeFileUpload(opts) {
  const { redis, provider, _config: config, amqp } = this;
  const { id, username, skipProcessing } = opts;
  const key = `upload-data:${id}`;

  return redis
    .pipeline()
    .exists(key)
    .hgetall(key)
    .exec()
    .spread((existsResponse, dataResponse) => {
      const exists = existsResponse[1];
      const data = dataResponse[1];

      if (!exists) {
        throw new HttpStatusError(404, 'could not find associated upload data');
      }

      if (username && data.owner !== username) {
        throw new HttpStatusError(403, 'upload does not belong to the provided user');
      }

      if (data.status !== STATUS_PENDING) {
        throw new HttpStatusError(412, 'upload has already been marked as finished');
      }

      const { filename } = data;

      return provider.exists(filename)
        .then(fileExists => {
          if (!fileExists) {
            throw new HttpStatusError(405, 'provider reports that upload was not finished yet');
          }

          const pipeline = redis.pipeline();
          const fileData = { ...data, status: STATUS_UPLOADED };

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
      if (skipProcessing) {
        return null;
      }

      const amqpConfig = config.amqp;
      const action = opts.await ? 'publishAndWait' : 'publish';
      const route = `${amqpConfig.prefix}.process`;
      return amqp[action](route, { filename: fileData.filename, username });
    });
};
