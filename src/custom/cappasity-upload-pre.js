const Promise = require('bluebird');
const assert = require('assert');

module.exports = function extractMetadata({ files, meta }) {
  let sourceSHA;

  return Promise
    .try(function verifyUploadData() {
      const fileTypes = {};
      let differentFileTypes = 0;

      // calculate file types
      files.forEach(props => {
        const type = props.type;

        if (fileTypes[type]) {
          fileTypes[type]++;
        } else {
          differentFileTypes++;
          fileTypes[type] = 1;
        }

        if (type === 'c-bin') {
          sourceSHA = props['source-sha'];
        }
      });

      // assert constraints
      if (differentFileTypes === 1) {
        assert.equal(fileTypes['c-preview'], 1, 'must contain exactly one preview');
      } else {
        // must always be true if it's not a simple preview upload
        assert.equal(fileTypes['c-bin'], 1, 'must contain exactly one binary upload');
        meta.sourceSHA = sourceSHA;
      }
    });
};
