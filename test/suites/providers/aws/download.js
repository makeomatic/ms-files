const assert = require('assert');
const uuid = require('uuid');
const url = require('url');
const { encodeURI } = require('@google-cloud/storage/build/src/util');

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
    updateAccess,
  } = require('../../../helpers/utils');

  const route = 'files.download';
  const bucketName = require('../../../configs/generic/core').transport[0].options.bucket.name;

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
      .then((err) => {
        assert.equal(err.statusCode, 404);
        return null;
      });
  });

  it('returns 412 when file is uploaded, but not processed', function test() {
    return this
      .send({ uploadId: this.response.uploadId, username: owner })
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert.equal(err.statusCode, 412);
        return null;
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
        .then((err) => {
          assert.equal(err.statusCode, 403);
          return null;
        });
    });

    it('returns download URLs: private', function test() {
      console.log('test 000');
      return this
        .send({ uploadId: this.response.uploadId, username: owner });
      // .reflect()
      // .then(inspectPromise())
      // .then((rsp) => {
      //   assert.ok(rsp.uploadId);
      //   assert.ok(rsp.files);
      //   assert.ok(rsp.urls);

      //   rsp.urls.forEach((link, idx) => {
      //     const parsedLink = url.parse(link, true);
      //     assert.equal(parsedLink.protocol, 'https:', link);
      //     assert.equal(parsedLink.host, 'storage.googleapis.com', link);
      //     assert.equal(parsedLink.pathname, `/${bucketName}/${encodeURI(rsp.files[idx].filename, false)}`, link);
      //     assert.ok(parsedLink.query.GoogleAccessId, link);
      //     assert.ok(parsedLink.query.Expires, link);
      //     assert.ok(parsedLink.query.Signature, link);
      //   });

      //   return null;
      // });
    });

    it('returns download partial renamed URLs: private', function test() {
      return this
        .send({
          uploadId: this.response.uploadId,
          username: owner,
          types: ['c-bin'],
          rename: true,
        })
        .reflect()
        .then(inspectPromise())
        .then((rsp) => {
          assert.ok(rsp.uploadId);
          assert.ok(rsp.files);
          assert.ok(rsp.urls);

          rsp.urls.forEach((link, idx) => {
            // check that we only have c-bin
            assert.equal(rsp.files[idx].type, 'c-bin');

            const parsedLink = url.parse(link, true);
            assert.equal(parsedLink.protocol, 'https:', link);
            assert.equal(parsedLink.host, process.env.AWS_STORAGE_HOST_NAME, link);
          });

          return null;
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
          .then((rsp) => {
            assert.ok(rsp.uploadId);
            assert.ok(rsp.files);
            assert.ok(rsp.urls);
            assert.equal(rsp.username, this.response.owner);

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
          .reflect()
          .then(inspectPromise())
          .then((rsp) => {
            assert.ok(rsp.uploadId);
            assert.ok(rsp.files);
            assert.ok(rsp.urls);

            rsp.urls.forEach((link, idx) => {
              // check that we only have c-bin
              assert.equal(rsp.files[idx].type, 'c-preview');

              const parsedLink = url.parse(link, true);
              assert.equal(parsedLink.protocol, 'https:', link);
              assert.equal(parsedLink.host, process.env.AWS_STORAGE_HOST_NAME, link);
            });

            return null;
          });
      });
    });
  });
});
