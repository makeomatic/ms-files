const Promise = require('bluebird');
const assert = require('assert');

module.exports = function extractMetadata({ files, meta }) {
  let sourceSHA;

  return Promise
    .try(function verifyUploadData() {
      const fileTypes = {};

      files.forEach(props => {
        const type = props.type;
        fileTypes[type] = fileTypes[type] && ++fileTypes[type] || 1;

        if (type === 'c-bin') {
          sourceSHA = props['source-sha'];
        }
      });

      // always true
      assert.equal(fileTypes['c-bin'], 1, 'must contain exactly one binary upload');

      // inject source sha
      meta.sourceSHA = sourceSHA;
    });
};
