/* global inspectPromise, SAMPLE_FILE */

const request = require('request-promise');
const assert = require('assert');
const { STATUS_UPLOADED } = require('../../src/constant.js');

describe('finish upload suite', function suite() {
  before(global.startService);
  after(global.clearService);

  const uploadMessage = {
    id: 'test@owner.com',
    contentType: SAMPLE_FILE.contentType,
    contentLength: SAMPLE_FILE.contentLength,
    name: SAMPLE_FILE.name,
    md5Hash: SAMPLE_FILE.md5,
  };

  const baseMessage = {
    skipProcessing: true,
    username: uploadMessage.id,
    id: 'bad-upload-id',
  };

  function prepareUpload() {
    return this.amqp.publishAndWait('files.upload', uploadMessage);
  }

  function completeUpload(data) {
    return request.put({
      url: data.location,
      body: SAMPLE_FILE.contents,
      headers: {
        'content-length': SAMPLE_FILE.contentLength,
      },
    });
  }

  before('prepare upload', function prepare() {
    return prepareUpload.call(this).then(data => {
      this.data = data;
    });
  });

  it('returns 404 on missing upload id', function test() {
    return this.amqp.publishAndWait('files.finish', baseMessage)
      .reflect()
      .then(inspectPromise(false))
      .then(error => {
        assert.equal(error.name, 'HttpStatusError');
        assert.equal(error.statusCode, 404);
      });
  });

  it('returns 403 on missmatch of owner and id', function test() {
    return this.amqp.publishAndWait('files.finish', {
      ...baseMessage,
      id: this.data.uploadId,
      username: 'thatsnotme@test.com',
    })
    .reflect()
    .then(inspectPromise(false))
    .then(error => {
      assert.equal(error.name, 'HttpStatusError');
      assert.equal(error.statusCode, 403);
    });
  });

  it('returns 405 when upload has not been processed yet', function test() {
    return this.amqp.publishAndWait('files.finish', {
      ...baseMessage,
      id: this.data.uploadId,
    })
    .reflect()
    .then(inspectPromise(false))
    .then(error => {
      assert.equal(error.name, 'HttpStatusError');
      assert.equal(error.statusCode, 405);
    });
  });

  describe('after upload has finished', function next() {
    before('complete upload', function prepare() {
      return completeUpload(this.data);
    });

    it('marks upload as finished', function test() {
      return this.amqp.publishAndWait('files.finish', {
        ...baseMessage,
        id: this.data.uploadId,
      })
      .reflect()
      .then(inspectPromise())
      .then(result => {
        assert.equal(result.status, STATUS_UPLOADED);
      });
    });

    // This clause is normally never entered, because upload-id data is deleted
    // right after it's marked as processed. At this point data can only be accessed via filename
    // Test exists, but skipped, because it's never the case unless the redis.del clause is
    // removed
    it.skip('returns 412 error when upload was already finished or processed', function test() {
      return this.amqp.publishAndWait('files.finish', {
        ...baseMessage,
        id: this.data.uploadId,
      })
      .reflect()
      .then(inspectPromise(false))
      .then(error => {
        assert.equal(error.name, 'HttpStatusError');
        assert.equal(error.statusCode, 412);
      });
    });
  });
});
