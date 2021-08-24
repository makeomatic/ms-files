const Promise = require('bluebird');
const assert = require('assert');
const { STATUS_PROCESSED } = require('../../../../src/constant');

// helpers
const {
  startService,
  stopService,
  modelData,
  owner,
  bindSend,
  initUpload,
} = require('../../../helpers/utils.js');

// data
const route = 'files.sync';

describe('finish upload suite', function suite() {
  // setup functions
  before('start service', startService);
  before('prepare upload', initUpload(modelData));
  before('helpers', bindSend(route));

  // tear-down
  after('stop service', stopService);

  it('...wait while upload completes', () => Promise.delay(10000));

  it('runs sync service', function test() {
    return this.send({}, 15000);
  });

  it('...waits for a couple of seconds', () => Promise.delay(10000));

  it('returns correct STATUS_PROCESSED', async function test() {
    const rsp = await this.amqp
      .publishAndWait('files.info', { filename: this.response.uploadId, username: owner });

    assert.ok(rsp.file.status === STATUS_PROCESSED, JSON.stringify(rsp.file));
  });
});
