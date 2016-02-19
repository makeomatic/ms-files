const Promise = require('bluebird');
const fetchData = require('../utils/fetchData.js');
const { HttpStatusError } = require('common-errors');
const {
  STATUS_UPLOADED,
  STATUS_PENDING,
  UPLOAD_DATA,
  FILES_INDEX,
  FILES_DATA,
} = require('../constant.js');


/**
 * Finish upload
 * @param  {Object} opts.id
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function completeFileUpload(opts) {
  const { redis, provider, _config: config, amqp } = this;
  const { id, username, skipProcessing } = opts;
  const key = `${UPLOAD_DATA}:${id}`;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(data => {
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
          const fileData = { ...data, uploadedAt: Date.now(), status: STATUS_UPLOADED };

          pipeline.sadd(FILES_INDEX, filename);
          pipeline.hmset(`${FILES_DATA}:${filename}`, fileData);
          pipeline.del(key);

          if (username || data.owner) {
            pipeline.sadd(`${FILES_INDEX}:${username || data.owner}`, filename);
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
