const Promise = require('bluebird');
const assert = require('assert');
const uuid = require('uuid');

// helpers
const {
  startService,
  stopService,
  inspectPromise,
  modelData,
  bindSend,
  initAndUpload,
  processUpload,
  resetSinon,
} = require('../helpers/utils.js');

// data
const route = 'files.process';
const { STATUS_PROCESSED } = require('../../src/constant.js');

describe('process suite', function suite() {
  // setup functions
  before('start service', startService);
  // sets `this.response` to `files.finish` response
  before('pre-upload file', initAndUpload(modelData));
  before('helpers', bindSend(route));

  // resets sinon spies
  beforeEach('reset sinon', resetSinon);

  // tear-down
  after('stop service', stopService);

  it('returns 404 on a missing upload id', function test() {
    return processUpload
      .call(this, { uploadId: uuid.v4() })
      .reflect()
      .then(inspectPromise(false))
      .then(err => {
        assert.equal(err.statusCode, 404);
      });
  });

  it('processes file', function test() {
    return processUpload
      .call(this, this.response)
      .reflect()
      .then(inspectPromise())
      .then(rsp => {
        assert.equal(rsp.status, STATUS_PROCESSED);
        assert.ok(rsp.files);
      });
  });

  it('returns 412 when we try to work on an already processed file', function test() {
    return processUpload
      .call(this, this.response)
      .reflect()
      .then(inspectPromise(false))
      .then(err => {
        assert.equal(err.statusCode, 412);
      });
  });

  it('exports processed file', function test() {
    const message = {
      uploadId: this.response.uploadId,
      export: {
        format: 'obj',
        compression: 'gz',
        meta: {
          extra: 1,
        },
      },
    };

    return Promise.all([
      this.send(message).reflect().then(inspectPromise()),
      this.send(message).reflect().then(inspectPromise(false)),
    ])
    .spread((res, err) => {
      assert.ok(this.files.config.hooks['files:process:post'].calledOnce);
      assert.ok(res.export);
      assert.ok(res.obj);

      assert.equal(err.statusCode, 409);
    });
  });

  it('denies to export processed file with same format, but diff compression', function test() {
    const message = {
      uploadId: this.response.uploadId,
      export: {
        format: 'obj',
        compression: 'zip',
      },
    };

    return this
      .send(message)
      .reflect()
      .then(inspectPromise(false))
      .then(err => {
        assert.equal(err.statusCode, 418);
      });
  });
});
