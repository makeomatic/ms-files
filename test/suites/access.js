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
  processUpload,
  updateAccess,
  getInfo,
} = require('../helpers/utils.js');

const route = 'files.access';

describe('access suite', function suite() {
  // setup functions
  before('start service', startService);

  // sets `this.response` to `files.finish` response
  before('pre-upload file', initAndUpload(modelData));
  before('pre-process file', function preprocess() {
    return processUpload.call(this, this.response);
  });
  before('helpers', bindSend(route));

  // tear-down
  after('stop service', stopService);

  // tests
  it('returns 404 on a missing file', function test() {
    return updateAccess
      .call(this, uuid.v4(), owner, true)
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert(err.statusCode, 404);
        return null;
      });
  });

  it('returns 403 on non-matching owner', function test() {
    return updateAccess
      .call(this, this.response.uploadId, 'martial@arts.com', true)
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert(err.statusCode, 403);
        return null;
      });
  });

  it('sets file to public', function test() {
    return updateAccess
      .call(this, this.response.uploadId, owner, false)
      .reflect()
      .then(inspectPromise());
  });

  it('sets file to private', function test() {
    return updateAccess
      .call(this, this.response.uploadId, owner, false)
      .reflect()
      .then(inspectPromise());
  });

  describe('direct upload', function directUploadSuite() {
    before('pre-upload file', initAndUpload({
      ...modelData,
      message: {
        ...modelData.message,
        directOnly: true,
        access: {
          setPublic: false,
        },
      },
    }));

    it('rejects to show direct only file without proper username', function test() {
      return getInfo
        .call(this, { filename: this.response.uploadId })
        .reflect()
        .then(inspectPromise(false));
    });

    it('set to public', function test() {

    });

    it('allows to show direct only file without proper username', function test() {

    });

    it('public list does not return direct only file', function test() {

    });
  });
});
