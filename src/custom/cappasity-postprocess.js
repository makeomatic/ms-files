const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const { FILES_PROCESS_ERROR_FIELD, FILES_DATA } = require('../constant.js');

const TYPE_MAP = {
  'c-preview': 'preview',
  'c-bin': 'model',
  'c-texture': 'texture',
  'c-archive': 'archive',
};

module.exports = function extractMetadata(data) {
  return Promise
    .try(function parseMeta() {
      const parsedFiles = typeof data.files === 'string' ? JSON.parse(data.files) : data.files;
      const output = {};

      let textures = 0;
      parsedFiles.forEach(({ type, filename }) => {
        const responsibility = TYPE_MAP[type];
        if (responsibility === 'texture') {
          output[`texture_${textures++}`] = filename;
        } else {
          output[responsibility] = filename;
        }
      });

      // so that we don't parse it again later
      data.files = parsedFiles;

      return output;
    })
    .tap(output => {
      if (!output.hasOwnProperty('archive')) {
        return null;
      }

      const { amqp, redis, config } = this;
      const { owner: username, uploadId } = data;
      const { users: { prefix, audience, getMetadata, updateMetadata } } = config;
      const update = `${prefix}.${updateMetadata}`;
      const get = `${prefix}.${getMetadata}`;

      return amqp
        .publishAndWait(get, { username, audience })
        .get(audience)
        .then(metadata => {
          if (metadata.roles && metadata.roles.indexOf('admin') >= 0) {
            return null;
          }

          // decrement model
          const message = {
            username,
            audience,
            metadata: { $incr: { models: -1 } },
          };

          return amqp
            .publishAndWait(updateMetadata, message)
            .then(result => {
              if (result.$incr.models >= 0) {
                return null;
              }

              // revert back
              message.metadata.$incr.models = 1;

              // publish
              return amqp
                .publishAndWait(update, message)
                .then(() => redis.hset(`${FILES_DATA}:${uploadId}`, FILES_PROCESS_ERROR_FIELD, '402'))
                .throw(new HttpStatusError(402, 'no more models are available'));
            });
        });
    });
};
