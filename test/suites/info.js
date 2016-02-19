/* global inspectPromise, SAMPLE_FILE, UPLOAD_MESSAGE, uploadToGoogle */

const assert = require('assert');
const { STATUS_PENDING, STATUS_UPLOADED, STATUS_PROCESSED } = require('../../src/constant.js');

describe('info suite', function suite() {
  before(global.startService);
  after(global.clearService);

  before('upload file', function test() {
    return this.amqp.publishAndWait('files.upload', UPLOAD_MESSAGE())
      .then(result => {
        this.data = result;
      });
  });

  it('404 on missing filename', function test() {
    return this.amqp.publishAndWait('files.info', {
      filename: 'i-do-not-exist',
    })
    .reflect()
    .then(inspectPromise(false))
    .then(error => {
      assert.equal(error.name, 'HttpStatusError');
      assert.equal(error.statusCode, 404);
    });
  });

  it('404 on missing upload id', function test() {
    return this.amqp.publishAndWait('files.info', {
      uploadId: 'i-do-not-exist',
    })
    .reflect()
    .then(inspectPromise(false))
    .then(error => {
      assert.equal(error.name, 'HttpStatusError');
      assert.equal(error.statusCode, 404);
    });
  });

  it('403 on valid upload id, invalid user', function test() {
    return this.amqp.publishAndWait('files.info', {
      uploadId: this.data.uploadId,
      username: 'not-an-owner@ok.com',
    })
    .reflect()
    .then(inspectPromise(false))
    .then(error => {
      assert.equal(error.name, 'HttpStatusError');
      assert.equal(error.statusCode, 403);
    });
  });

  it('STATUS_PENDING on valid upload id', function test() {
    return this.amqp.publishAndWait('files.info', {
      uploadId: this.data.uploadId,
      username: this.data.owner,
    })
    .reflect()
    .then(inspectPromise())
    .then(data => {
      assert.equal(data.filename, this.data.filename);
      assert.equal(data.status, STATUS_PENDING);
    });
  });

  describe('after upload', function afterUploadSuite() {
    before('complete upload', function test() {
      return uploadToGoogle(this.data)
        .then(() => {
          return this.amqp.publishAndWait('files.finish', {
            id: this.data.uploadId,
            skipProcessing: true,
          });
        });
    });

    it('403 on invalid user id', function test() {
      return this.amqp.publishAndWait('files.info', {
        filename: this.data.filename,
        username: 'not-an-owner@ok.com',
      })
      .reflect()
      .then(inspectPromise(false))
      .then(error => {
        assert.equal(error.name, 'HttpStatusError');
        assert.equal(error.statusCode, 403);
      });
    });

    it('STATUS_UPLOADED on valid user id', function test() {
      return this.amqp.publishAndWait('files.info', {
        filename: this.data.filename,
        username: this.data.owner,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.equal(data.filename, this.data.filename);
        assert.equal(data.status, STATUS_UPLOADED);
      });
    });

    it('STATUS_UPLOADED without user id', function test() {
      return this.amqp.publishAndWait('files.info', {
        filename: this.data.filename,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.equal(data.filename, this.data.filename);
        assert.equal(data.status, STATUS_UPLOADED);
      });
    });

    describe('after processed', function afterProcessedSuite() {
      before('process file', function test() {
        return this.amqp.publishAndWait('files.process', { filename: this.data.filename });
      });

      it('STATUS_PROCESSED', function test() {
        return this.amqp.publishAndWait('files.info', {
          filename: this.data.filename,
        })
        .reflect()
        .then(inspectPromise())
        .then(data => {
          assert.equal(data.filename, this.data.filename);
          assert.equal(data.status, STATUS_PROCESSED);
        });
      });
    });
  });
});
