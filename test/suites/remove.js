/* global inspectPromise, SAMPLE_FILE, UPLOAD_MESSAGE, uploadToGoogle */

const assert = require('assert');

describe('remove suite', function suite() {
  before(global.startService);
  after(global.clearService);

  before('upload file', function test() {
    return this.amqp.publishAndWait('files.upload', UPLOAD_MESSAGE())
      .then(result => {
        this.data = result;
      });
  });

  it('404 on missing filename', function test() {
    return this.amqp
      .publishAndWait('files.remove', { filename: 'missing' })
      .reflect()
      .then(inspectPromise(false))
      .then(error => {
        assert.equal(error.name, 'HttpStatusError');
        assert.equal(error.statusCode, 404);
      });
  });

  it('404 on missing upload id', function test() {
    return this.amqp
      .publishAndWait('files.remove', { uploadId: 'missing' })
      .reflect()
      .then(inspectPromise(false))
      .then(error => {
        assert.equal(error.name, 'HttpStatusError');
        assert.equal(error.statusCode, 404);
      });
  });

  it('error 404 when file was not uploaded completely', function test() {
    return this.amqp
      .publishAndWait('files.remove', { uploadId: this.data.uploadId })
      .reflect()
      .then(inspectPromise(false))
      .then(error => {
        assert.equal(error.name, 'HttpStatusError');
        assert.equal(error.statusCode, 404);
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
      return this.amqp
        .publishAndWait('files.remove', {
          filename: this.data.filename,
          username: 'not-an-owner@ex.com',
        })
        .reflect()
        .then(inspectPromise(false))
        .then(error => {
          assert.equal(error.name, 'HttpStatusError');
          assert.equal(error.statusCode, 403);
        });
    });

    it('removes file data', function test() {
      return this.amqp
        .publishAndWait('files.remove', { filename: this.data.filename, username: this.data.owner })
        .reflect()
        .then(inspectPromise());
    });
  });
});
