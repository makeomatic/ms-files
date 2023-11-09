const assert = require('assert');
const uuid = require('uuid');
const url = require('url');
const { encodeURI } = require('../../src/utils/encode-uri');

describe('download suite', function suite() {
  // helpers
  const {
    startService,
    stopService,
    owner,
    modelData,
    bindSend,
    initAndUpload,
    processUpload,
    updateAccess,
  } = require('../helpers/utils');

  const route = 'files.download';
  let bucketName;

  // setup functions
  before('start service', async function startAll() {
    const service = await startService.call(this);
    bucketName = service.config.transport[0].options.bucket.name;
  });

  // sets `this.response` to `files.finish` response
  before('pre-upload file', initAndUpload(modelData));
  before('helpers', bindSend(route));

  // tear-down
  after('stop service', stopService);

  // tests
  it('returns 404 on a missing file', function test() {
    return assert.rejects(this.send({ uploadId: uuid.v4(), username: owner }), {
      statusCode: 404,
    });
  });

  it('returns 412 when file is uploaded, but not processed', function test() {
    return assert.rejects(this.send({ uploadId: this.response.uploadId, username: owner }), {
      statusCode: 412,
    });
  });

  describe('processed upload', function processedSuite() {
    before('process', function pretest() {
      return processUpload.call(this, this.response);
    });

    it('returns 403 on a user mismatch', function test() {
      return assert.rejects(this.send({ uploadId: this.response.uploadId, username: 'martial@arts.com' }), {
        statusCode: 403,
      });
    });

    it('returns download URLs: private', function test() {
      return this
        .send({ uploadId: this.response.uploadId, username: owner })
        .then((rsp) => {
          assert.ok(rsp.uploadId);
          assert.ok(rsp.files);
          assert.ok(rsp.urls);

          rsp.urls.forEach((link, idx) => {
            const parsedLink = url.parse(link, true);
            assert.equal(parsedLink.protocol, 'https:', link);
            assert.equal(parsedLink.host, 'storage.googleapis.com', link);
            assert.equal(parsedLink.pathname, `/${bucketName}/${encodeURI(rsp.files[idx].filename, false)}`, link);
            assert.ok(parsedLink.query['X-Goog-Algorithm'], link);
            assert.ok(parsedLink.query['X-Goog-Expires'], link);
            assert.ok(parsedLink.query['X-Goog-Credential'], link);
            assert.ok(parsedLink.query['X-Goog-Date'], link);
            assert.ok(parsedLink.query['X-Goog-Signature'], link);
            assert.ok(parsedLink.query['X-Goog-SignedHeaders'], link);
          });

          return null;
        });
    });

    it('returns download partial renamed URLs: private', function test() {
      return this
        .send({
          uploadId: this.response.uploadId,
          username: owner,
          types: ['c-bin'],
          rename: true,
        })
        .then((rsp) => {
          assert.ok(rsp.uploadId);
          assert.ok(rsp.files);
          assert.ok(rsp.urls);

          rsp.urls.forEach((link, idx) => {
            // check that we only have c-bin
            assert.equal(rsp.files[idx].type, 'c-bin');

            const parsedLink = url.parse(link, true);
            assert.equal(parsedLink.protocol, 'https:', link);
            assert.equal(parsedLink.host, 'storage.googleapis.com', link);
            assert.equal(parsedLink.pathname, `/${bucketName}/${encodeURI(rsp.files[idx].filename, false)}`, link);
            assert.ok(parsedLink.query['X-Goog-Algorithm'], link);
            assert.ok(parsedLink.query['X-Goog-Expires'], link);
            assert.ok(parsedLink.query['X-Goog-Credential'], link);
            assert.ok(parsedLink.query['X-Goog-Date'], link);
            assert.ok(parsedLink.query['X-Goog-Signature'], link);
            assert.ok(parsedLink.query['X-Goog-SignedHeaders'], link);
            // @todo ok or not?
            assert.ok(parsedLink.query['response-content-disposition'], link);
          });

          return null;
        });
    });

    describe('public file', function publicSuite() {
      before('make-file-public', function pretest() {
        return updateAccess.call(this, this.response.uploadId, owner, true);
      });

      it('returns download URLs: public', function test() {
        return this
          .send({ uploadId: this.response.uploadId })
          .then((rsp) => {
            assert.ok(rsp.uploadId);
            assert.ok(rsp.files);
            assert.ok(rsp.urls);
            assert.equal(rsp.username, this.response.owner);

            rsp.urls.forEach((link, idx) => {
              const parsedLink = url.parse(link, true);
              assert.equal(parsedLink.protocol, 'https:', link);
              assert.equal(parsedLink.host, 'storage.googleapis.com', link);
              assert.equal(parsedLink.pathname, `/${bucketName}/${encodeURI(rsp.files[idx].filename, false)}`, link);
              assert.ifError(parsedLink.query['X-Goog-Algorithm'], link);
              assert.ifError(parsedLink.query['X-Goog-Expires'], link);
              assert.ifError(parsedLink.query['X-Goog-Credential'], link);
              assert.ifError(parsedLink.query['X-Goog-Date'], link);
              assert.ifError(parsedLink.query['X-Goog-Signature'], link);
              assert.ifError(parsedLink.query['X-Goog-SignedHeaders'], link);
            });

            return null;
          });
      });

      it('returns download partial renamed URLs: public', function test() {
        return this
          .send({
            uploadId: this.response.uploadId,
            types: ['c-preview'],
            rename: true,
          })
          .then((rsp) => {
            assert.ok(rsp.uploadId);
            assert.ok(rsp.files);
            assert.ok(rsp.urls);

            rsp.urls.forEach((link, idx) => {
              // check that we only have c-bin
              assert.equal(rsp.files[idx].type, 'c-preview');

              const parsedLink = url.parse(link, true);
              assert.equal(parsedLink.protocol, 'https:', link);
              assert.equal(parsedLink.host, 'storage.googleapis.com', link);
              assert.equal(parsedLink.pathname, `/${bucketName}/${encodeURI(rsp.files[idx].filename, false)}`, link);
              assert.ok(parsedLink.query['X-Goog-Algorithm'], link);
              assert.ok(parsedLink.query['X-Goog-Expires'], link);
              assert.ok(parsedLink.query['X-Goog-Credential'], link);
              assert.ok(parsedLink.query['X-Goog-Date'], link);
              assert.ok(parsedLink.query['X-Goog-Signature'], link);
              assert.ok(parsedLink.query['X-Goog-SignedHeaders'], link);
              assert.ok(parsedLink.query['response-content-disposition'], link);
            });

            return null;
          });
      });
    });
  });
});
