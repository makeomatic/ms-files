const assert = require('assert');
const uuid = require('uuid');

// helpers
const {
  startService,
  stopService,
  inspectPromise,
  owner,
  modelData,
  bindSend,
  finishUpload,
  processUpload,
  initUpload,
  updateAccess,
} = require('../helpers/utils.js');

const route = 'files.info';
const { STATUS_PENDING, STATUS_UPLOADED, STATUS_PROCESSED } = require('../../src/constant.js');

describe('info suite', function suite() {
  // setup functions
  before('start service', startService);

  // sets `this.response` to `files.finish` response
  before('init upload', initUpload(modelData));
  before('helpers', bindSend(route));

  // tear-down
  after('stop service', stopService);

  it('404 on missing filename/upload-id', function test() {
    return this
      .send({ filename: uuid.v4(), username: owner })
      .reflect()
      .then(inspectPromise(false))
      .then(err => {
        assert.equal(err.statusCode, 404);
      });
  });

  it('404 on valid upload id, invalid user', function test() {
    return this
      .send({ filename: this.response.uploadId, username: 'martial@arts.com' })
      .reflect()
      .then(inspectPromise(false))
      .then(err => {
        assert.equal(err.statusCode, 404);
      });
  });

  it('STATUS_PENDING on valid upload id', function test() {
    return this
      .send({ filename: this.response.uploadId, username: owner })
      .reflect()
      .then(inspectPromise())
      .then(rsp => {
        assert.equal(rsp.username, owner);
        assert.deepEqual(rsp.file, this.response);
        assert.equal(rsp.file.status, STATUS_PENDING);
      });
  });

  describe('after upload', function afterUploadSuite() {
    before('complete upload', function pretest() {
      return finishUpload.call(this, this.response);
    });

    it('404 on invalid user id', function test() {
      return this
        .send({ filename: this.response.uploadId, username: 'martial@arts.com' })
        .reflect()
        .then(inspectPromise(false))
        .then(err => {
          assert.equal(err.statusCode, 404);
        });
    });

    it('STATUS_UPLOADED on valid user id', function test() {
      return this
        .send({ filename: this.response.uploadId, username: owner })
        .reflect()
        .then(inspectPromise())
        .then(rsp => {
          assert.equal(rsp.username, owner);
          assert.equal(rsp.file.status, STATUS_UPLOADED);
        });
    });

    describe('after processed', function afterProcessedSuite() {
      before('process file', function pretest() {
        return processUpload.call(this, this.response);
      });

      it('returns 404 on invalid user id', function test() {
        return this
          .send({ filename: this.response.uploadId, username: 'martial@arts.com' })
          .reflect()
          .then(inspectPromise(false))
          .then(err => {
            assert.equal(err.statusCode, 404);
          });
      });

      it('returns correct STATUS_PROCESSED', function test() {
        return this
          .send({ filename: this.response.uploadId, username: owner })
          .reflect()
          .then(inspectPromise())
          .then(rsp => {
            assert.equal(rsp.username, owner);
            assert.equal(rsp.file.status, STATUS_PROCESSED);
            assert.ifError(rsp.file.public);

            assert.ok(rsp.file.files);
            rsp.file.files.forEach(file => {
              assert.ok(file.decompressedLength);
              assert.ok(file.contentLength);
              assert.ok(file.decompressedLength > file.contentLength);
            });
          });
      });

      describe('public file', function publicSuite() {
        before('make public', function pretest() {
          return updateAccess.call(this, this.response.uploadId, owner, true);
        });

        it('returns info when file is public', function test() {
          return this
            .send({ filename: this.response.uploadId, username: owner })
            .reflect()
            .then(inspectPromise())
            .then(rsp => {
              assert.equal(rsp.username, owner);
              assert.equal(rsp.file.owner, owner);
              assert.equal(rsp.file.public, '1');
              assert.equal(rsp.file.status, STATUS_PROCESSED);

              assert.ok(rsp.file.files);
              rsp.file.files.forEach(file => {
                assert.ok(file.decompressedLength);
                assert.ok(file.contentLength);
                assert.ok(file.decompressedLength > file.contentLength);
              });
            });
        });
      });
    });
  });
});
