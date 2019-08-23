const assert = require('assert');
const uuid = require('uuid');

describe('access suite', function suite() {
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
    downloadFile,
  } = require('../helpers/utils');

  const route = 'files.access';

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
      .call(this, this.response.uploadId, owner, true)
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

    it('post-processes files', function test() {
      return this.files
        .postProcess(0, Date.now())
        .reflect()
        .then(inspectPromise());
    });

    it('rejects to show direct only file without proper username', function test() {
      return downloadFile
        .call(this, { uploadId: this.response.uploadId })
        .reflect()
        .then(inspectPromise(false));
    });

    it('set to public', function test() {
      return updateAccess
        .call(this, this.response.uploadId, owner, true)
        .reflect()
        .then(inspectPromise());
    });

    it('allows to show direct only file without proper username', function test() {
      return downloadFile
        .call(this, { uploadId: this.response.uploadId })
        .reflect()
        .then(inspectPromise());
    });

    it('public list does not return direct only file', function test() {
      return this
        .amqp
        .publishAndWait('files.list', {
          public: true,
          username: owner,
        })
        .reflect()
        .then(inspectPromise())
        .get('files')
        .then((response) => {
          const directUpload = response.find((it) => it.id === this.response.uploadId);
          assert.ifError(directUpload, 'direct upload was returned from public list');
          return null;
        });
    });
  });
});
