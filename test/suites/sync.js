const Promise = require('bluebird');
const assert = require('assert');
const { STATUS_PENDING } = require('../../src/constant.js');

// helpers
const {
  startService,
  stopService,
  inspectPromise,
  modelData,
  owner,
  bindSend,
  initUpload,
} = require('../helpers/utils.js');

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

  it('returns correct STATUS_PROCESSED', function test() {
    return this.amqp
      .publishAndWait('files.info', { filename: this.response.uploadId, username: owner })
      .reflect()
      .then(inspectPromise())
      .then(rsp => {
        assert.ifError(rsp.file.status === STATUS_PENDING);
      });
  });
});
