/* eslint-disable no-await-in-loop */
const Promise = require('bluebird');
const assert = require('assert');
const md5 = require('md5');
const uuid = require('uuid');

// helpers
const {
  startService,
  stopService,
  modelData,
  owner,
  bindSend,
  initUpload,
} = require('../helpers/utils');

// data
const route = 'files.finish';

describe('finish upload suite', function suite() {
  // setup functions
  before('start service', startService);
  before('prepare upload', initUpload(modelData));
  before('helpers', bindSend(route));

  // tear-down
  after('stop service', stopService);

  // tests
  it('return 400 on invalid filename', function test() {
    return assert.rejects(this.send({ filename: 'random name' }), {
      name: 'HttpStatusError',
      statusCode: 400,
    });
  });

  it('returns 200: 404 on missing filename', function test() {
    return assert.rejects(this.send({ filename: [md5(owner), uuid.v4(), uuid.v4()].join('/') }), (err) => {
      try {
        assert.equal(err.statusCode, 200);
        assert.ok(/^404: /.test(err.message));
      } catch (_) {
        return false;
      }
      return true;
    });
  });

  it('returns progress and 409 on repeated notification', function test() {
    const [file] = this.response.files;
    return Promise.mapSeries([file, file], (_, idx) => {
      return assert.rejects(this.send({ filename: file.filename }), idx === 0 ? {
        statusCode: 202,
        message: `1/${this.response.files.length} uploaded`,
      } : {
        statusCode: 200,
        message: '412: upload was already processed',
      });
    });
  });

  it('returns progress until all files have uploaded', function test() {
    const files = this.response.files.slice(1, 3);
    return Promise.mapSeries(files, async (file, idx) => {
      await assert.rejects(this.send({ filename: file.filename }), {
        statusCode: 202,
        message: `${idx + 2}/${this.response.files.length} uploaded`,
      });
    });
  });

  it('returns "upload was already processed" for subsequent messages', function test() {
    const files = this.response.files.slice(0, 3);
    return Promise.mapSeries(files, (file) => {
      return assert.rejects(this.send({ filename: file.filename }), {
        statusCode: 200,
        message: /^412: /,
      });
    });
  });

  it('returns "upload completed, processing skipped" on final part', function test() {
    const file = this.response.files[3];
    return this
      .send({ filename: file.filename, skipProcessing: true })
      .then((response) => {
        assert.equal(response, 'upload completed, processing skipped');
        return null;
      });
  });

  describe('directOnly upload public model', function directOnlySuite() {
    before('prepare upload of directOnly file', initUpload({
      ...modelData,
      message: {
        ...modelData.message,
        directOnly: true,
      },
    }));

    it('finishes upload', async function test() {
      const total = this.response.files.length;
      for (const [idx, file] of this.response.files.entries()) {
        if (idx !== total - 1) {
          await assert.rejects(this.send({ filename: file.filename, await: true }));
        } else {
          await this.send({ filename: file.filename, await: true });
        }
      }
    });

    it('list does not return this file from public list', async function test() {
      const { files: response } = await this.amqp.publishAndWait('files.list', {
        public: true,
        username: modelData.message.username,
      });

      const directUpload = response.find((it) => it.id === this.response.uploadId);
      assert.ifError(directUpload, 'direct upload was returned from public list');
    });

    it('list returns this file for private list', async function test() {
      const { files: response } = await this.amqp.publishAndWait('files.list', {
        public: false,
        username: modelData.message.username,
      });

      const directUpload = response.find((it) => it.id === this.response.uploadId);
      assert.ok(directUpload, 'direct upload was correctly returned');
    });

    it('report endpoint returns stats for public & private models', function test() {
      return this
        .amqp
        .publishAndWait('files.report', {
          username: modelData.message.username,
          includeStorage: true,
        })
        .then((response) => {
          assert.equal(response.total, 2);
          assert.equal(response.public, 0);
          assert.equal(response.totalContentLength, 3802306);
          assert.equal(response.publicContentLength, 0);
          return null;
        });
    });
  });
});
