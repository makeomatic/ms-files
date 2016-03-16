const Promise = require('bluebird');
const Errors = require('common-errors');
const { FILES_PROCESS_ERROR_FIELD, FILES_DATA } = require('../constant.js');

const TYPE_MAP = {
  'c-preview': 'preview',
  'c-bin': 'model',
  'c-texture': 'texture',
  'c-archive': 'archive',
};

module.exports = function extractMetadata(data) {
  const { amqp, config, redis } = this;
  const { users: { audience, getMetadata, updateMetadata } } = config;
  const username = data.owner;

  return amqp
    .publishAndWait(getMetadata, { username, audience })
    .get(audience)
    .then(metadata => {
      if (metadata.roles && metadata.roles.indexOf('admin') >= 0) {
        return null;
      }

      const message = {
        username,
        audience,
        metadata: {
          $incr: {
            models: -1,
          },
        },
      };

      return amqp
        .publishAndWait(updateMetadata, message, { timeout: 5000 })
        .then(result => {
          if (result.$incr.models >= 0) {
            return null;
          }

          // revert back
          message.metadata.$incr.models = 1;

          // publish
          return amqp
            .publish(updateMetadata, message)
            .then(() => redis.hset(`${FILES_DATA}:${data.uploadId}`, FILES_PROCESS_ERROR_FIELD, '402'))
            .throw(new Errors.HttpStatusError(402, 'no more models are available'));
        });
    })
    .then(() => Promise.try(function parseMeta() {
      const files = JSON.parse(data.files);
      const output = {};

      let textures = 0;
      files.forEach(({ type, filename }) => {
        const responsibility = TYPE_MAP[type];
        if (responsibility === 'texture') {
          output[`texture_${textures++}`] = filename;
        } else {
          output[responsibility] = filename;
        }
      });

      return output;
    }));
};
