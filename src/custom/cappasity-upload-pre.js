const Errors = require('common-errors');
const Promise = require('bluebird');
const assert = require('assert');
const checkUploadsLimit = require('../utils/checkUploadsLimit');
const isCappasityUpload = require('../utils/isCappasityUpload');
const { FILES_PACKED_FIELD } = require('../constant');

const isPack = it => it.type === 'c-pack';

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
          throw new Errors.HttpStatusError(412, 'following upload must be unlisted');
        }

        if (!access.setPublic) {
          throw new Errors.HttpStatusError(412, 'following upload must be public');
        }
      } else if (cappasityUpload) {
        // must always be true if it's not a simple preview upload
        assert.equal(fileTypes['c-bin'], 1, 'must contain exactly one binary upload');
        meta.sourceSHA = sourceSHA;

        if (meta.export && !temp) {
          throw new Errors.HttpStatusError(412, 'temp must be set to true');
        }
      } else {
        throw new Errors.HttpStatusError(400, 'should be either a cappasity model or a single image');
      }

      return null;
    })
    .bind(this, params)
    .tap(checkUploadsLimit);
};
