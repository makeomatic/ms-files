const assert = require('assert');
const uuid = require('uuid');
const faker = require('faker');

const {
  startService,
  stopService,
  inspectPromise,
  owner,
  modelData,
  bindSend,
  initAndUpload,
  processUpload,
  downloadFile,
  getInfo,
  meta,
  backgroundData,
} = require('../helpers/utils.js');

const route = 'files.update';
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
      getInfo.call(this, {
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

          return getInfo.call(this, {
            filename: this.response.uploadId,
            username,
          })
          .tap(verifyResult => {
            assert.deepEqual(verifyResult.file.tags, meta.tags);
          });
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

          return getInfo.call(this, {
            filename: this.response.uploadId,
            username,
          })
          .tap(verifyResult => {
            assert.equal(verifyResult.file.backgroundColor, meta.backgroundColor);
          });
        });
    });
  });

  describe('update background image', function afterUpdateSuite() {
    before('upload background image', function upload() {
      return initAndUpload(backgroundData, false).call(this)
        .then(downloadFile.bind(this))
        .then(({ files, urls }) => { // eslint-disable-line no-shadow
          const url = urls[0];
          const file = files[0];
          const { filename, contentType } = file;

          meta.backgroundImage = {
            url,
            filename,
            contentType,
          };
        });
    });

    it('update background image', function test() {
      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .reflect()
        .then(inspectPromise())
        .then(result => {
          assert.equal(result, true);

          return getInfo.call(this, {
            filename: this.response.uploadId,
            username,
          })
          .tap(verifyResult => {
            assert.deepEqual(verifyResult.file.backgroundImage, meta.backgroundImage);
          });
        });
    });

    it('failed to update background image due to wrong origin', function test() {
      meta.backgroundImage.url = faker.image.imageUrl();
      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .reflect()
        .then(inspectPromise(false))
        .then(err => {
          assert.equal(err.statusCode, 412);
        });
    });
  });
});
