/* global inspectPromise, SAMPLE_FILE, UPLOAD_MESSAGE, uploadToGoogle */

const assert = require('assert');

describe('access suite', function suite() {
  before(global.startService);
  after(global.clearService);

  before('upload file', function test() {
    return this
      .amqp
      .publishAndWait('files.upload', UPLOAD_MESSAGE())
      .tap(uploadToGoogle)
      .then(data =>
        this.amqp.publishAndWait('files.finish', {
          id: data.uploadId,
          skipProcessing: false,
          await: true,
        })
      )
      .then(result => {
        this.data = result;
      });
  });

  it('returns 404 on a missing file', function test() {
    return this.amqp.publishAndWait('files.access', {
      filename: 'does-not-exist',
      setPublic: true,
    })
    .reflect()
    .then(inspectPromise(false))
    .then(error => {
      assert.equal(error.name, 'HttpStatusError');
      assert.equal(error.statusCode, 404);
    });
  });

  it('returns 403 on non-matching owner', function test() {
    return this.amqp.publishAndWait('files.access', {
      filename: this.data.filename,
      owner: 'random@owner.com',
      setPublic: true,
    })
    .reflect()
    .then(inspectPromise(false))
    .then(error => {
      assert.equal(error.name, 'HttpStatusError');
      assert.equal(error.statusCode, 403);
    });
  });

  it('sets file to public', function test() {
    return this.amqp.publishAndWait('files.access', {
      filename: this.data.filename,
      owner: this.data.owner,
      setPublic: true,
    })
    .reflect()
    .then(inspectPromise());
  });

  it('sets file to public', function test() {
    return this.amqp.publishAndWait('files.access', {
      filename: this.data.filename,
      owner: this.data.owner,
      setPublic: false,
    })
    .reflect()
    .then(inspectPromise());
  });
});
