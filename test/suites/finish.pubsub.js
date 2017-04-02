const Promise = require('bluebird');
const assert = require('assert');

// helpers
const {
  startService,
  stopService,
  inspectPromise,
  modelData,
  owner,
  getInfo,
  bindSend,
  initUpload,
  uploadFiles,
} = require('../helpers/utils.js');

const {
  enablePubsub,
} = require('../helpers/config');

const {
  STATUS_PROCESSED,
} = require('../../src/constant');

// data
const route = 'files.finish';

describe('finish upload suite with pubsub for hooks', function suite() {
  // setup functions
  before('enable pubsub', enablePubsub);
  before('start service', startService);
  before('prepare upload', initUpload(modelData));
  before('helpers', bindSend(route));

  // tear-down
  after('stop service', stopService);

  it('completes file upload', function test() {
    return uploadFiles(modelData, this.response)
    .reflect()
    .then(inspectPromise())
    .map((resp) => {
      assert.equal(resp.statusCode, 200);
      return null;
    });
  });

  it('wait for 5 seconds', () => Promise.delay(5000));

  it('verify that upload was processed', function test() {
    return getInfo
      .call(this, { filename: this.response.uploadId, username: owner })
      .reflect()
      .then(inspectPromise())
      .then((rsp) => {
        assert.equal(rsp.file.status, STATUS_PROCESSED);
        return null;
      });
  });

  it('verify service.postProcess is still on', function test() {
    return this.files
      .postProcess()
      .reflect()
      .then(inspectPromise());
  });
});
