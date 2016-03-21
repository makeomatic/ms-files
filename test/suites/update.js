const assert = require('assert');
const uuid = require('uuid');

const {
  startService,
  stopService,
  inspectPromise,
  owner,
  modelData,
  bindSend,
  initAndUpload,
  processUpload,
  config,
} = require('../helpers/utils.js');

const route = 'files.update';

const meta = {
  name: 'name',
  description: 'description',
  tags: [
    'tag1',
    'tag2',
    'tag3'
  ],
  website: 'http://website.com'
};

describe('update suite', function suite() {

  before('start service', startService);
  before('pre-upload file', initAndUpload(modelData));
  before('helpers', bindSend(route));
  after('stop service', stopService);

  it('returns 404 when file not found', function test() {
    return this
      .send({ uploadId: uuid.v4(), username: owner })
      .reflect()
      .then(inspectPromise(false))
      .then(err => {
        assert.equal(err.statusCode, 404);
      });
  });

  it('returns 412 when file is not processed', function test() {

    const message = {
      uploadId: this.response.uploadId,
      username: owner,
      meta: meta
    };

    return this
      .send(message, 45000)
      .reflect()
      .then(inspectPromise(false))
      .then(err => {
        assert.equal(err.statusCode, 412);
      });
  });

  describe('process update', function processedSuite() {
    before('process', function pretest() {
      return processUpload.call(this, this.response);
    });

    it('returns 403 on a user mismatch', function test() {
      return this
        .send({ uploadId: this.response.uploadId, username: 'test@test.com' })
        .reflect()
        .then(inspectPromise(false))
        .then(err => {
          assert.equal(err.statusCode, 403);
        });
    });

    it('initiates update and returns correct response format', function test() {

      const message = {
        uploadId: this.response.uploadId,
        username: owner,
        meta
      };

      return this
        .send(message, 45000)
        .reflect()
        .then(inspectPromise())
        .then(rsp => {
          assert.equal(rsp.uploadId, message.uploadId);
          assert.deepEqual(rsp.name, message.meta.name);
          assert.deepEqual(rsp.description, message.meta.description);
          assert.deepEqual(rsp.tags, message.meta.tags);
          assert.deepEqual(rsp.website, message.meta.website);
        });
    });
  });
});
