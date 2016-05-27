const assert = require('assert');
const uuid = require('uuid');
const url = require('url');

describe('download suite', function suite() {
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
    config,
    updateAccess,
  } = require('../helpers/utils.js');

  const route = 'files.download';
  const bucketName = config.transport[0].options.bucket.name;

  // setup functions
  before('start service', startService);

  // sets `this.response` to `files.finish` response
  before('pre-upload file', initAndUpload(modelData));
  before('helpers', bindSend(route));

  // tear-down
  after('stop service', stopService);

  // tests
  it('returns 404 on a missing file', function test() {
    return this
      .send({ uploadId: uuid.v4(), username: owner })
      .reflect()
      .then(inspectPromise(false))
      .then(err => {
        assert.equal(err.statusCode, 404);
      });
  });

  it('returns 412 when file is uploaded, but not processed', function test() {
    return this
      .send({ uploadId: this.response.uploadId, username: owner })
      .reflect()
      .then(inspectPromise(false))
      .then(err => {
        assert.equal(err.statusCode, 412);
      });
  });

  describe('processed upload', function processedSuite() {
    before('process', function pretest() {
      return processUpload.call(this, this.response);
    });

    it('returns 403 on a user mismatch', function test() {
      return this
        .send({ uploadId: this.response.uploadId, username: 'martial@arts.com' })
        .reflect()
        .then(inspectPromise(false))
        .then(err => {
          assert.equal(err.statusCode, 403);
        });
    });

    it('returns download URLs: private', function test() {
      return this
        .send({ uploadId: this.response.uploadId, username: owner })
        .reflect()
        .then(inspectPromise())
        .then(rsp => {
          assert.ok(rsp.uploadId);
          assert.ok(rsp.files);
          assert.ok(rsp.urls);

          rsp.urls.forEach((link, idx) => {
            const parsedLink = url.parse(link, true);
            assert.equal(parsedLink.protocol, 'https:', link);
            assert.equal(parsedLink.host, 'storage.googleapis.com', link);
            assert.equal(parsedLink.pathname, `/${bucketName}/${encodeURIComponent(rsp.files[idx].filename)}`, link);
            assert.ok(parsedLink.query.GoogleAccessId, link);
            assert.ok(parsedLink.query.Expires, link);
            assert.ok(parsedLink.query.Signature, link);
          });
        });
    });

    describe('public file', function publicSuite() {
      before('make-file-public', function pretest() {
        return updateAccess
          .call(this, this.response.uploadId, owner, true)
          .reflect()
          .then(inspectPromise());
      });

      it('returns download URLs: public', function test() {
        return this
          .send({ uploadId: this.response.uploadId })
          .reflect()
          .then(inspectPromise())
          .then(rsp => {
            assert.ok(rsp.uploadId);
            assert.ok(rsp.files);
            assert.ok(rsp.urls);
            assert.equal(rsp.username, this.response.owner);

            rsp.urls.forEach((link, idx) => {
              const parsedLink = url.parse(link, true);
              assert.equal(parsedLink.protocol, 'https:', link);
              assert.equal(parsedLink.host, bucketName, link);
              assert.equal(parsedLink.pathname, `/${encodeURIComponent(rsp.files[idx].filename)}`, link);
              assert.ifError(parsedLink.query.GoogleAccessId, link);
              assert.ifError(parsedLink.query.Expires, link);
              assert.ifError(parsedLink.query.Signature, link);
            });
          });
      });
    });
  });
});
