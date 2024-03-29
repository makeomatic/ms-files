const Promise = require('bluebird');
const assert = require('assert');

// helpers
const {
  startService,
  stopService,
  modelData,
  owner,
  getInfo,
  bindSend,
  initUpload,
  uploadFiles,
} = require('../helpers/utils');

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

  it('completes file upload', async function test() {
    const responses = await uploadFiles(modelData, this.response);
    assert(responses.every(({ status }) => status === 200));
  });

  it('verify that upload was processed', function test() {
    // eslint-disable-next-line
    const attempt = arguments[0] || 0;

    return getInfo
      .call(this, { filename: this.response.uploadId, username: owner })
      .then((rsp) => {
        try {
          assert.equal(rsp.file.status, STATUS_PROCESSED);
        } catch (e) {
          // 20 * 500 = 10s to make sure it is processed
          if (attempt > 20) throw e;
          return Promise.bind(this, attempt + 1).delay(5000).then(test);
        }

        return null;
      });
  });

  it('verify service.postProcess is still on', function test() {
    return this.files.postProcess();
  });
});
