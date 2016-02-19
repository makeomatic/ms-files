/* global inspectPromise, SAMPLE_FILE, UPLOAD_MESSAGE, uploadToGoogle */

const assert = require('assert');

describe('process suite', function suite() {
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
    return this.amqp
      .publishAndWait('files.process', { filename: 'i-do-not-exist' })
      .reflect()
      .then(inspectPromise(false))
      .then(error => {
        assert.equal(error.name, 'HttpStatusError');
        assert.equal(error.statusCode, 404);
      });
  });

  it('returns 403 on non-matching owner', function test() {
    return this.amqp
      .publishAndWait('files.process', {
        filename: this.data.filename,
        username: 'i-m-not-the@owner.com',
      })
      .reflect()
      .then(inspectPromise(false))
      .then(error => {
        assert.equal(error.name, 'HttpStatusError');
        assert.equal(error.statusCode, 403);
      });
  });

  it('processes file', function test() {
    return this.amqp
      .publishAndWait('files.process', {
        filename: this.data.filename,
        username: this.data.owner,
      })
      .reflect()
      .then(inspectPromise());
  });

  it('returns 412 when we try to work on a processed file', function test() {
    return this.amqp
      .publishAndWait('files.process', {
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
});
