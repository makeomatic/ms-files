const Promise = require('bluebird');
const assert = require('assert');
const uuid = require('uuid');

// helpers
const {
  startService,
  stopService,
  modelData,
  bindSend,
  initAndUpload,
  processUpload,
  resetSinon,
} = require('../helpers/utils');

// data
const route = 'files.process';
const { STATUS_PROCESSED } = require('../../src/constant');

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
    return assert.rejects(processUpload.call(this, { uploadId: uuid.v4() }), {
      statusCode: 404,
    });
  });

  it('processes file', function test() {
    return processUpload
      .call(this, this.response)
      .then((rsp) => {
        assert.equal(rsp.status, STATUS_PROCESSED);
        assert.ok(rsp.files);
        return null;
      });
  });

  it('returns 412 when we try to work on an already processed file', function test() {
    return assert.rejects(processUpload.call(this, this.response), {
      statusCode: 412,
    });
  });

  it('exports processed file', async function test() {
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

    const [res] = await Promise.all([
      this.send(message),
      assert.rejects(this.send(message), { statusCode: 409 }),
    ]);

    assert.ok(this.files.config.hooks['files:process:post'].calledOnce);
    assert.ok(res.export);
    assert.ok(res.obj);
  });

  it('denies to export processed file with same format, but diff compression', function test() {
    const message = {
      uploadId: this.response.uploadId,
      export: {
        format: 'obj',
        compression: 'zip',
      },
    };

    return assert.rejects(this.send(message), {
      statusCode: 418,
    });
  });

  describe('internal process failure', function suiteFailure() {
    before('remap post-processing', function before() {
      this.files.on('files:process:post', function failure() {
        return Promise.reject(new Error('internal failure'));
      });
    });

    before('pre-upload file', initAndUpload(modelData));

    before('reset onComplete count', function before() {
      this.files.config.routerAmqp.retry.predicate.resetHistory();
    });

    it('fails due to post-processing issue', function test() {
      return assert.rejects(processUpload.call(this, this.response), {
        message: 'could not process file',
      });
    });

    it('wait for 2 seconds to ensure that requeue worked', function test() {
      const spy = this.files.config.routerAmqp.retry.predicate;
      return Promise.delay(2000).then(() => {
        return assert.ok(spy.calledTwice, 'onComplete was called twice');
      });
    });

    it('next time it wont process because it reached max attempts', function test() {
      return assert.rejects(processUpload.call(this, this.response), {
        message: 'could not process file',
      });
    });
  });
});
