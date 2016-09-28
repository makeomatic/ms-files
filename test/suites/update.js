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
  meta,
} = require('../helpers/utils.js');

const route = 'files.update';
const infoRoute = 'files.info';
const username = owner;

describe('update suite', function suite() {
  before('start service', startService);
  before('pre-upload file', initAndUpload(modelData));
  before('helpers', bindSend(route));
  after('stop service', stopService);

  it('returns 404 when file not found', function test() {
    return this
      .send({ uploadId: uuid.v4(), username, meta })
      .reflect()
      .then(inspectPromise(false))
      .then(err => {
        assert.equal(err.statusCode, 404);
      });
  });

  it('returns 412 when file is not processed', function test() {
    return this
      .send({ uploadId: this.response.uploadId, username, meta }, 45000)
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

    it('initiates update and returns correct response format', function test() {
      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .reflect()
        .then(inspectPromise())
        .then(result => {
          assert.equal(result, true);
        });
    });
  });

  describe('process info', function afterUpdateSuite() {
    it('returns file info', function test() {
      return this
        .amqp.publishAndWait(infoRoute, {
          filename: this.response.uploadId,
          username,
        })
        .reflect()
        .then(inspectPromise())
        .then(result => {
          assert.equal(result.username, username);
          assert.equal(result.file.uploadId, this.response.uploadId);
          assert.equal(result.file.name, meta.name);
          assert.equal(result.file.description, meta.description);
          assert.equal(result.file.website, meta.website);
          assert.deepEqual(result.file.tags, meta.tags);
        });
    });
  });

  describe('process update again', function afterUpdateSuite() {
    it('initiates update again with other tags', function test() {
      meta.tags = ['tag4', 'tag5', 'tag6'];

      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .reflect()
        .then(inspectPromise())
        .then(result => {
          assert.equal(result, true);
        });
    });

    it('update background color', function test() {
      meta.backgroundColor = '#00ffFa';

      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .reflect()
        .then(inspectPromise())
        .then(result => {
          assert.equal(result, true);
        });
    });
  });

  describe('process info again', function afterUpdateSuite() {
    it('returns file info to check updated tags', function test() {
      return this
        .amqp.publishAndWait(infoRoute, {
          filename: this.response.uploadId,
          username,
        })
        .reflect()
        .then(inspectPromise())
        .then(result => {
          assert.deepEqual(result.file.tags, meta.tags);
          assert.equal(result.file.backgroundColor, meta.backgroundColor);
        });
    });
  });
});
