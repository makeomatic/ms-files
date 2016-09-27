const Promise = require('bluebird');
const find = require('lodash/find');
const { HttpStatusError } = require('common-errors');
const { FILES_OWNER_FIELD, FILES_EXPORT_FIELD } = require('../constant.js');

module.exports = function uploadPost(props) {
  const { amqp, config } = this;
  const { getMetadata, audience, exportAudience } = config.users;

  return Promise
    .try(function verifyUploadData() {
      if (!props[FILES_EXPORT_FIELD]) {
        return null;
      }

      const binary = find(props.files, { type: 'c-bin' });
      if (!binary) {
        return null;
      }

      const sourceSHA = binary['source-sha256'];

      // check if we already have exported that item
      const message = {
        username: props[FILES_OWNER_FIELD],
        audience: [exportAudience, audience],
        fields: {
          [exportAudience]: [sourceSHA],
          [audience]: ['models'],
        },
      };

      // getMetadata
      return amqp
        .publishAndWait(getMetadata, message)
        .then((it) => {
          props.exported = it[exportAudience][sourceSHA] || false;
          props.availableModels = it[audience].models;

          if (!props.exported && !props.availableModels) {
            throw new HttpStatusError(412, 'no available models');
          }
        });
    });
};
