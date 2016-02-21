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

  });

  it('returns 403 on non-matching owner', function test() {

  });

  it('sets file to public', function test() {

  });

  it('sets file to public', function test() {

  });
});
