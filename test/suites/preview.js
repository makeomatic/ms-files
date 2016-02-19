/* global inspectPromise, SAMPLE_FILE, UPLOAD_MESSAGE, SAMPLE_MODEL, uploadToGoogle */

const assert = require('assert');

describe('process suite', function suite() {
  before(global.startService);
  after(global.clearService);

  before('upload file', function test() {
    return this.amqp
      .publishAndWait('files.upload', UPLOAD_MESSAGE(SAMPLE_MODEL))
      .tap(data => uploadToGoogle(data, SAMPLE_MODEL))
      .then(data => this.amqp.publishAndWait('files.finish', { id: data.uploadId, await: true }))
      .then(result => {
        this.data = result;
      });
  });

  it('generates preview', function test() {
    console.log(this.data);
    // return this.amqp
    //   .publishAndWait('files.preview', {
    //
    //   })
  });
});
