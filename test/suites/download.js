/* global inspectPromise, SAMPLE_FILE, UPLOAD_MESSAGE, uploadToGoogle */

const assert = require('assert');
const { STATUS_PROCESSED, STATUS_UPLOADED } = require('../../src/constant.js');

describe('download suite', function suite() {
  before(global.startService);
  after(global.clearService);

  before('upload file', function test() {
    return this.amqp.publishAndWait('files.upload', UPLOAD_MESSAGE())
      .tap(uploadToGoogle)
      .then(data => {
        return this.amqp.publishAndWait('files.finish', {
          id: data.uploadId,
          skipProcessing: true,
        });
      })
      .then(result => {
        this.data = result;
      });
  });

  it('returns 404 on a missing file', function test() {
    return this.amqp.publishAndWait('files.download', {
      filename: 'does-not-exist',
    })
    .reflect()
    .then(inspectPromise(false))
    .then(error => {
      assert.equal(error.name, 'HttpStatusError');
      assert.equal(error.statusCode, 404);
    });
  });

  it('returns 412 when file is uploaded, but not processed', function test() {
    return this.amqp.publishAndWait('files.download', {
      filename: this.data.filename,
      username: this.data.owner,
    })
    .reflect()
    .then(inspectPromise(false))
    .then(error => {
      assert.equal(error.name, 'HttpStatusError');
      assert.equal(error.statusCode, 412);
    });
  });

  it('returns download URL when username is not specified', function test() {
    return this.amqp.publishAndWait('files.download', {
      filename: this.data.filename,
    })
    .reflect()
    .then(inspectPromise())
    .then(data => {
      assert.ok(data.url);
      assert.ok(data.data);
      assert.equal(data.data.status, STATUS_UPLOADED);
      assert.equal(data.data.filename, this.data.filename);
      assert.equal(data.data.owner, this.data.owner);
    });
  });

  describe('after process', function afterProcessSuite() {
    before('process file', function test() {
      return this.amqp.publishAndWait('files.process', { filename: this.data.filename });
    });

    it('returns 403 on a user mismatch', function test() {
      return this.amqp.publishAndWait('files.download', {
        filename: this.data.filename,
        username: 'i-m-not@owner.com',
      })
      .reflect()
      .then(inspectPromise(false))
      .then(error => {
        assert.equal(error.name, 'HttpStatusError');
        assert.equal(error.statusCode, 403);
      });
    });

    it('returns download URL: no owner specified', function test() {
      return this.amqp.publishAndWait('files.download', {
        filename: this.data.filename,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.url);
        assert.ok(data.data);
        assert.ok(data.data.owner);
        assert.equal(data.data.status, STATUS_PROCESSED);
        assert.equal(data.data.filename, this.data.filename);
      });
    });

    it('returns download URL: with owner specified', function test() {
      return this.amqp.publishAndWait('files.download', {
        filename: this.data.filename,
        username: this.data.owner,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.url);
        assert.ok(data.data);
        assert.equal(data.data.status, STATUS_PROCESSED);
        assert.equal(data.data.filename, this.data.filename);
        assert.equal(data.data.owner, this.data.owner);
      });
    });
  });
});
