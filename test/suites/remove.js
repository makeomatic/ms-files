const Promise = require('bluebird');
const assert = require('assert');
const uuid = require('uuid');

// helpers
const {
  startService,
  stopService,
  inspectPromise,
  owner,
  modelData,
  bindSend,
  initAndUpload,
} = require('../helpers/utils');

const route = 'files.remove';

describe('remove suite', function suite() {
  // setup functions
  before('start service', startService);
  // sets `this.response` to `files.finish` response
  before('pre-upload file', initAndUpload(modelData));
  before('helpers', bindSend(route));

  // tear-down
  after('stop service', stopService);

  //
  it('404 on missing filename/upload-id', function test() {
    return this
      .send({ filename: uuid.v4(), username: owner })
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert.equal(err.name, 'HttpStatusError');
        assert.equal(err.statusCode, 404);
      });
  });

  it('403 on invalid user id', function test() {
    return this
      .send({
        filename: this.response.uploadId,
        username: 'martial@arts.com',
      })
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert.equal(err.name, 'HttpStatusError');
        assert.equal(err.statusCode, 403);
      });
  });

  it('removes file data', function test() {
    return this
      .send({ filename: this.response.uploadId, username: owner })
      .reflect()
      .then(inspectPromise());
  });

  it('waits a bit.... 3seconds', () => Promise.delay(3000));

  it('404 on subsequent remove', function test() {
    return this
      .send({ filename: this.response.uploadId, username: owner })
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert.equal(err.statusCode, 404);
      });
  });
});
