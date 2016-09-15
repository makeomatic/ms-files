const assert = require('assert');
const uuid = require('node-uuid');

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
const {
  STATUS_PENDING,
  STATUS_UPLOADED,
  STATUS_PROCESSED,
} = require('../../src/constant.js');

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

  it('401 on valid upload id, invalid user', function test() {
    return this
      .send({ filename: this.response.uploadId, username: 'martial@arts.com' })
      .reflect()
      .then(inspectPromise(false))
      .then(err => {
        assert.equal(err.statusCode, 401);
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
        assert.equal(rsp.file.embed, undefined);
        assert.equal(rsp.file.status, STATUS_PENDING);
      });
  });

  describe('after upload', function afterUploadSuite() {
    before('complete upload', function pretest() {
      return finishUpload.call(this, this.response);
    });

    it('401 on invalid user id', function test() {
      return this
        .send({ filename: this.response.uploadId, username: 'martial@arts.com' })
        .reflect()
        .then(inspectPromise(false))
        .then(err => {
          assert.equal(err.statusCode, 401);
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

      it('returns 401 on invalid user id', function test() {
        return this
          .send({ filename: this.response.uploadId, username: 'martial@arts.com' })
          .reflect()
          .then(inspectPromise(false))
          .then(err => {
            assert.equal(err.statusCode, 401);
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

            assert.ok(Array.isArray(rsp.file.controlsData));
            assert.ok(Array.isArray(rsp.file.tags));

            assert.equal(rsp.file.controlsData.length, 29);
            assert.deepEqual(rsp.file.tags, ['ok', 'done']);

            assert.ifError(rsp.file.public);

            assert.ok(rsp.file.files);
            rsp.file.files.forEach(file => {
              assert.ok(file.contentLength);
              if (file.type === 'c-bin') {
                assert.ok(file.decompressedLength);
                assert.ok(file.decompressedLength > file.contentLength);
              }
            });

            assert.ok(rsp.file.embed);
            assert.ok(rsp.file.embed.code);
            assert.equal(typeof rsp.file.embed.code, 'string');
            assert.notEqual(rsp.file.embed.code.length, 0);
            assert.ok(rsp.file.embed.params);

            Object.keys(rsp.file.embed.params).forEach(key => {
              const param = rsp.file.embed.params[key];
              assert.ok(param.type);
              assert.notEqual(param.default, undefined);
              assert.ok(param.description);
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
                assert.ok(file.contentLength);
                if (file.type === 'c-bin') {
                  assert.ok(file.decompressedLength);
                  assert.ok(file.decompressedLength > file.contentLength);
                }
              });
            });
        });
      });
    });
  });
});
