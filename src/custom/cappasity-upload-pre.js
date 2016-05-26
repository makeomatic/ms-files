const Promise = require('bluebird');
const assert = require('assert');

module.exports = function extractMetadata(files) {
  return Promise
    .try(function verifyUploadData() {
      const fileTypes = {};
      files.forEach(({ type }) => {
        fileTypes[type] = fileTypes[type] && ++fileTypes[type] || 1;
      });

      // always true
      assert.equal(fileTypes['c-bin'], 1, 'must contain exactly one binary upload');
    })
    .return(files);
};
