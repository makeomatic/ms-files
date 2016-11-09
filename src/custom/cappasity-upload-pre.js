const Errors = require('common-errors');
const Promise = require('bluebird');
const assert = require('assert');
const isCappasityUpload = require('../utils/isCappasityUpload');

module.exports = function extractMetadata({ files, meta, temp, unlisted, access, resumable }) {
  let sourceSHA;

  return Promise
    .try(function verifyUploadData() {
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

        if (!resumable) {
          if (unlisted) {
            throw new Errors.HttpStatusError(412, 'simple upload could not be unlisted');
          }

          if (temp) {
            throw new Errors.HttpStatusError(412, 'simple upload could not be temp');
          }

          return;
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
    });
};
