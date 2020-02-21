const assert = require('assert');
const uuid = require('uuid');

// helpers
const {
  startService,
  stopService,
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

  it('404 on missing filename/upload-id', async function test() {
    const req = this.send({ filename: uuid.v4(), username: owner });
    await assert.rejects(req, { statusCode: 404 });
  });

  it('401 on valid upload id, invalid user', async function test() {
    const req = this.send({ filename: this.response.uploadId, username: 'martial@arts.com' });
    await assert.rejects(req, { statusCode: 401 });
  });

  it('STATUS_PENDING on valid upload id', async function test() {
    const rsp = await this.send({ filename: this.response.uploadId, username: owner });
    assert.equal(rsp.username, owner);
    assert.deepEqual(rsp.file, this.response);
    assert.equal(rsp.file.embed, undefined);
    assert.equal(rsp.file.status, STATUS_PENDING);
  });

  describe('after upload', function afterUploadSuite() {
    before('complete upload', async function pretest() {
      await finishUpload.call(this, this.response);
    });

    it('401 on invalid user id', async function test() {
      const req = this.send({ filename: this.response.uploadId, username: 'martial@arts.com' });
      await assert.rejects(req, { statusCode: 401 });
    });

    it('400 on missing username', async function test() {
      const req = this.send({ filename: this.response.uploadId });
      await assert.rejects(req, { statusCode: 400 });
    });

    it('not throws 401 if noCheckOwner is set', async function testInfoInternal() {
      const { file } = await this.send({ filename: this.response.uploadId, skipOwnerCheck: true });
      assert.equal(file.owner, owner);
      assert.equal(file.uploadId, this.response.uploadId);
    });

    it('STATUS_UPLOADED on valid user id', async function test() {
      const rsp = await this.send({ filename: this.response.uploadId, username: owner });
      assert.equal(rsp.username, owner);
      assert.equal(rsp.file.status, STATUS_UPLOADED);
    });

    describe('after processed', function afterProcessedSuite() {
      before('process file', async function pretest() {
        await processUpload.call(this, this.response);
      });

      it('returns 401 on invalid user id', async function test() {
        const req = this.send({ filename: this.response.uploadId, username: 'martial@arts.com' });
        await assert.rejects(req, { statusCode: 401 });
      });

      it('returns correct STATUS_PROCESSED', async function test() {
        const rsp = await this.send({ filename: this.response.uploadId, username: owner });
        assert.equal(rsp.username, owner);
        assert.equal(rsp.file.status, STATUS_PROCESSED);

        assert.ok(Array.isArray(rsp.file.controlsData));
        assert.ok(Array.isArray(rsp.file.tags));

        assert.equal(rsp.file.controlsData.length, 29);
        assert.deepEqual(rsp.file.tags, ['ok', 'done']);

        assert.ifError(rsp.file.public);

        assert.ok(rsp.file.files);
        rsp.file.files.forEach((file) => {
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

        Object.keys(rsp.file.embed.params).forEach((key) => {
          const param = rsp.file.embed.params[key];
          assert.ok(param.type);
          assert.notStrictEqual(param.default, undefined);
          assert.ok(param.description);
        });
      });

      describe('public file', function publicSuite() {
        before('make public', async function pretest() {
          await updateAccess.call(this, this.response.uploadId, owner, true);
        });

        it('returns info when file is public', async function test() {
          const rsp = await this.send({ filename: this.response.uploadId, username: owner });
          assert.equal(rsp.username, owner);
          assert.equal(rsp.file.owner, owner);
          assert.equal(rsp.file.public, '1');
          assert.equal(rsp.file.status, STATUS_PROCESSED);

          assert.ok(rsp.file.files);
          rsp.file.files.forEach((file) => {
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
