const Promise = require('bluebird');
const assert = require('assert');

module.exports = function extractMetadata(files) {
  return Promise
    .try(function verifyUploadData() {
      const fileTypes = {};
      files.forEach(({ type }) => {
        fileTypes[type] = fileTypes[type] && ++fileTypes[type] || 1;
      });

      assert.equal(fileTypes['c-bin'], 1, 'must contain exactly one binary upload');
      assert.equal(fileTypes['c-preview'], 1, 'must contain preview');
      assert.ok(typeof fileTypes['c-archive'] === 'undefined' || fileTypes['c-archive'] <= 1, 'must contain not more than 1 prepared archive');
      assert.ok(fileTypes['c-texture'] >= 1, 'must contain at least one texture');
    })
    .return(files);
};
