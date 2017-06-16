const assert = require('assert');
const Promise = require('bluebird');
const get = require('lodash/get');
const noop = require('lodash/noop');
const includes = require('lodash/includes');
const { HttpStatusError } = require('common-errors');

const isCappasityUpload = require('../utils/isCappasityUpload');
const {
  FILES_INDEX,
  FILES_OWNER_FIELD,
  FILES_PACKED_FIELD,
} = require('../constant.js');

const isPack = it => it.type === 'c-pack';

// resolve real username and fetch plan data
function getUserData(alias) {
  const { amqp, config } = this;
  const { planGet } = config.payments;
  const { getInternalData, getMetadata, audience } = config.users;

  const promises = [
    // get real username
    amqp.publishAndWait(getInternalData, {
      username: alias,
      fields: ['username'],
    }),

    // fetch current user's plan and roles
    amqp.publishAndWait(getMetadata, {
      username: alias,
      audience: [audience],
      fields: {
        [audience]: ['roles', 'plan'],
      },
    }),
  ];

  return Promise.all(promises).spread((internal, attributes) => {
    const { username } = internal;
    const { roles, plan } = attributes[audience];

    // fetch plan data
    return amqp
      .publishAndWait(planGet.route, { id: plan }, planGet.options)
      .then(planData => ({
        username,
        roles,
        plan: planData,
      }));
  });
}

// check limit of uploadings by username
function checkUploadsLimit(params) {
  const { redis } = this;

  // get user's roles and limit of embeddings according his plan
  return Promise.bind(this, params[FILES_OWNER_FIELD])
    .then(getUserData)
    .then((data) => {
      const { username, roles, plan } = data;
      const isAdmin = includes(roles, 'admin');

      // skip next checks if user is admin
      if (isAdmin) {
        return null;
      }

      const FILES_PER_USER_SET = `${FILES_INDEX}:${username}`;
      const embeddings = get(plan, 'meta.embeddings.value', 0);

      return redis.scard(FILES_PER_USER_SET).then((uploadedFiles) => {
        const isOutOfLimit = uploadedFiles >= embeddings;

        if (isOutOfLimit) {
          throw HttpStatusError(412, 'no available embeddings');
        }

        return null;
      });
    });
}

module.exports = function extractMetadata(params) {
  let sourceSHA;

  const {
    files,
    meta,
    temp,
    unlisted,
    access,
    uploadType,
  } = params;

  // treat all indexed uploads as cappasity models
  // https://github.com/makeomatic/ms-files/blob/master/src/actions/finish.js#L112
  const cappasityModel = !(unlisted || temp);

  return Promise
    .try(function verifyUploadData() {
      if (uploadType === 'simple' && files.find(isPack)) {
        meta[FILES_PACKED_FIELD] = '1';
        return null;
      }

      // use relevant validation
      // based on upload type in the json schema
      if (uploadType) {
        return null;
      }

      const fileTypes = {};
      let differentFileTypes = 0;

      // calculate file types
      files.forEach((props) => {
        const type = props.type;

        if (fileTypes[type]) {
          fileTypes[type] += 1;
        } else {
          differentFileTypes += 1;
          fileTypes[type] = 1;
        }

        if (type === 'c-bin') {
          sourceSHA = props['source-sha256'];
        }
      });

      const cappasityUpload = isCappasityUpload(Object.keys(fileTypes));
      // assert constraints
      if (differentFileTypes === 1) {
        if (cappasityUpload) {
          assert.equal(fileTypes['c-preview'], 1, 'must contain exactly one preview');
        }

        if (!unlisted) {
          throw new HttpStatusError(412, 'following upload must be unlisted');
        }

        if (!access.setPublic) {
          throw new HttpStatusError(412, 'following upload must be public');
        }
      } else if (cappasityUpload) {
        // must always be true if it's not a simple preview upload
        assert.equal(fileTypes['c-bin'], 1, 'must contain exactly one binary upload');
        meta.sourceSHA = sourceSHA;

        if (meta.export && !temp) {
          throw new HttpStatusError(412, 'temp must be set to true');
        }
      } else {
        throw new HttpStatusError(400, 'should be either a cappasity model or a single image');
      }

      return null;
    })
    .bind(this)
    .return(params)
    .then(cappasityModel ? checkUploadsLimit : noop);
};
