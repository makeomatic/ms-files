const Promise = require('bluebird');
const find = require('lodash/find');
const includes = require('lodash/includes');
const { HttpStatusError } = require('common-errors');
const {
  FILES_INDEX,
  FILES_OWNER_FIELD,
  CAPPASITY_TYPE_MAP,
  CAPPASITY_3D_MODEL,
  CAPPASITY_IMAGE_MODEL,
} = require('../constant.js');

const CAPPASITY_FILES = Object.keys(CAPPASITY_TYPE_MAP);
const CAPPASITY_MODELS = [
  CAPPASITY_3D_MODEL,
  CAPPASITY_IMAGE_MODEL,
];

function hasCappasityModelFiles(files) {
  return find(files, file => includes(CAPPASITY_FILES, file.type));
}

function isCappasityModel(uploadType) {
  return includes(CAPPASITY_MODELS, uploadType);
}

function isCappasityUpload(params) {
  const { files, uploadType } = params;
  return uploadType ? isCappasityModel(uploadType)
                    : hasCappasityModelFiles(files); // BC
}

module.exports = function checkUploadsLimit(params) {
  const { redis, amqp, config } = this;
  const { getMetadata, audience } = config.users;

  const username = params[FILES_OWNER_FIELD];
  const FILES_PER_USER_SET = `${FILES_INDEX}:${username}`;

  if (!isCappasityUpload(params)) {
    return null;
  }

  const message = {
    username,
    audience: [audience],
    fields: {
      [audience]: ['roles', 'embeddings'],
    },
  };

  const promises = [
    // get user's roles and limit of embeddings according his plan
    amqp.publishAndWait(getMetadata, message),
    // get maximum of available embeddings
    redis.scard(FILES_PER_USER_SET),
  ];

  return Promise
    .all(promises)
    .spread((user, uploadedFiles) => {
      const { roles, embeddings } = user[audience];

      const isAdmin = includes(roles, 'admin');
      const isOutOfLimit = uploadedFiles >= embeddings;

      if (!isAdmin && isOutOfLimit) {
        throw HttpStatusError(412, 'no available embeddings');
      }

      return null;
    });
};
