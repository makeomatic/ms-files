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
} = require('../helpers/utils.js');

// data
const route = 'files.process';
const { STATUS_PROCESSED } = require('../../lib/constant.js');

describe('process suite', function suite() {
  // setup functions
  before('start service', startService);
  // sets `this.response` to `files.finish` response
  before('pre-upload file', initAndUpload(modelData));
  before('helpers', bindSend(route));

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
});
