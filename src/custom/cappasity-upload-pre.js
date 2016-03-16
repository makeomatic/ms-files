const Promise = require('bluebird');
const Errors = require('common-errors');
const assert = require('assert');

module.exports = function extractMetadata(files, username) {
  const { amqp, config } = this;
  const { users: { audience, getMetadata } } = config;

  return Promise
    .try(function verifyUploadData() {
      const fileTypes = {};
      files.forEach(({ type }) => {
        fileTypes[type] = fileTypes[type] && ++fileTypes[type] || 1;
      });

      assert.equal(fileTypes['c-bin'], 1, 'must contain exactly one binary upload');
      assert.equal(fileTypes['c-preview'], 1, 'must contain preview');
      assert.equal(fileTypes['c-archive'], 1, 'must contain prepared archive');
      assert.ok(fileTypes['c-texture'] >= 1, 'must contain at least one texture');
    })
    .then(() => amqp.publishAndWait(getMetadata, { username, audience }))
    .get(audience)
    .then(({ models = 0, roles = [] }) => {
      if (models <= 0 && roles.indexOf('admin') === -1) {
        throw new Errors.HttpStatusError(402, 'no more models are available');
      }
    })
    .return(files);
};
