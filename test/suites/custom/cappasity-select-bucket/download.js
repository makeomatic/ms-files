const assert = require('assert');
const uuid = require('uuid');
const url = require('url');
const { encodeURI } = require('@google-cloud/storage/build/src/util');

function overrideConfig() {
  this.configOverride = {
    selectTransport: require('../../../../src/custom/cappasity-select-bucket.js'),
    transport: [{
      name: 'gce',
      options: {
        gce: {
          projectId: process.env.GCLOUD_PROJECT_ID,
          credentials: {
            client_email: process.env.GCLOUD_PROJECT_EMAIL,
            private_key: process.env.GCLOUD_PROJECT_PK,
          },
        },
        bucket: {
          name: process.env.TEST_BUCKET,
          metadata: {
            location: process.env.GCLOUD_BUCKET_LOCATION || 'EUROPE-WEST1',
            dra: true,
          },
        },
        // test for direct public URLs
      },
      // its not a public name!
      cname: 'gce',
    }, {
      name: 'oss',
      options: {
        accessKeyId: process.env.OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        bucket: '3dshot',
        region: 'cn-beijing',
        secure: true,
      },
      urlExpire: 1000 * 60 * 60 * 3, // 3h
    }],
  };
}

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
  before(overrideConfig);
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
      return this
        .send({ uploadId: this.response.uploadId, username: owner })
        .reflect()
        .then(inspectPromise())
        .then((rsp) => {
          assert.ok(rsp.uploadId);
          assert.ok(rsp.files);
          assert.ok(rsp.urls);

          rsp.urls.forEach((link, idx) => {
            const parsedLink = url.parse(link, true);
            assert.equal(parsedLink.protocol, 'https:', link);
            assert.equal(parsedLink.host, 'storage.googleapis.com', link);
            assert.equal(parsedLink.pathname, `/${bucketName}/${encodeURI(rsp.files[idx].filename, false)}`, link);
            assert.ok(parsedLink.query.GoogleAccessId, link);
            assert.ok(parsedLink.query.Expires, link);
            assert.ok(parsedLink.query.Signature, link);
          });

          return null;
        });
    });

    it('returns download URLs: private (oss provider)', async function test() {
      const response = await this.amqp.publishAndWait(route, {
        uploadId: this.response.uploadId,
        username: owner,
      }, {
        headers: {
          'x-cappasity-source': 'cn-beijing',
        },
      });

      assert.ok(response.uploadId);
      assert.ok(response.files);
      assert.ok(response.urls);

      response.urls.forEach((link, idx) => {
        const parsedLink = url.parse(link, true);
        assert.equal(parsedLink.protocol, 'https:', link);
        assert.equal(parsedLink.host, '3dshot.cn-beijing.aliyuncs.com', link);
        assert.equal(parsedLink.pathname, `/${encodeURI(response.files[idx].filename, false)}`, link);
        assert.ok(parsedLink.query.OSSAccessKeyId, link);
        assert.ok(parsedLink.query.Expires, link);
        assert.ok(parsedLink.query.Signature, link);
        assert.ok(parsedLink.query['response-content-disposition'], link);
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
            assert.equal(parsedLink.host, 'storage.googleapis.com', link);
            assert.equal(parsedLink.pathname, `/${bucketName}/${encodeURI(rsp.files[idx].filename, false)}`, link);
            assert.ok(parsedLink.query.GoogleAccessId, link);
            assert.ok(parsedLink.query.Expires, link);
            assert.ok(parsedLink.query.Signature, link);
            // @todo ok or not?
            assert.ok(parsedLink.query['response-content-disposition'], link);
          });

          return null;
        });
    });

    it('returns download partial renamed URLs: private (oss provider)', async function test() {
      const response = await this.amqp.publishAndWait(route, {
        uploadId: this.response.uploadId,
        username: owner,
        types: ['c-bin'],
        rename: true,
      }, {
        headers: {
          'x-cappasity-source': 'cn-beijing',
        },
      });

      assert.ok(response.uploadId);
      assert.ok(response.files);
      assert.ok(response.urls);

      response.urls.forEach((link, idx) => {
        // check that we only have c-bin
        assert.equal(response.files[idx].type, 'c-bin');

        const parsedLink = url.parse(link, true);
        assert.equal(parsedLink.protocol, 'https:', link);
        assert.equal(parsedLink.host, '3dshot.cn-beijing.aliyuncs.com', link);
        assert.equal(parsedLink.pathname, `/${encodeURI(response.files[idx].filename, false)}`, link);
        assert.ok(parsedLink.query.OSSAccessKeyId, link);
        assert.ok(parsedLink.query.Expires, link);
        assert.ok(parsedLink.query.Signature, link);
        assert.ok(parsedLink.query['response-content-disposition'], link);
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

            rsp.urls.forEach((link, idx) => {
              const parsedLink = url.parse(link, true);
              assert.equal(parsedLink.protocol, 'https:', link);
              assert.equal(parsedLink.host, 'storage.googleapis.com', link);
              assert.equal(parsedLink.pathname, `/${bucketName}/${encodeURI(rsp.files[idx].filename, false)}`, link);
              assert.ifError(parsedLink.query.GoogleAccessId, link);
              assert.ifError(parsedLink.query.Expires, link);
              assert.ifError(parsedLink.query.Signature, link);
            });

            return null;
          });
      });

      it('returns download URLs: public (oss provider)', async function test() {
        const response = await this.amqp.publishAndWait(route, {
          uploadId: this.response.uploadId,
        }, {
          headers: {
            'x-cappasity-source': 'cn-beijing',
          },
        });

        assert.ok(response.uploadId);
        assert.ok(response.files);
        assert.ok(response.urls);
        assert.equal(response.username, this.response.owner);

        response.urls.forEach((link, idx) => {
          const parsedLink = url.parse(link, true);
          assert.equal(parsedLink.protocol, 'https:', link);
          assert.equal(parsedLink.host, '3dshot.cn-beijing.aliyuncs.com', link);
          assert.equal(parsedLink.pathname, `/${encodeURI(response.files[idx].filename, false)}`, link);
          assert.ifError(parsedLink.query.OSSAccessKeyId, link);
          assert.ifError(parsedLink.query.Expires, link);
          assert.ifError(parsedLink.query.Signature, link);
          // @todo ok or not
          assert.ifError(parsedLink.query['response-content-disposition'], link);
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
              assert.equal(parsedLink.host, 'storage.googleapis.com', link);
              assert.equal(parsedLink.pathname, `/${bucketName}/${encodeURI(rsp.files[idx].filename, false)}`, link);
              assert.ok(parsedLink.query.GoogleAccessId, link);
              assert.ok(parsedLink.query.Expires, link);
              assert.ok(parsedLink.query.Signature, link);
              assert.ok(parsedLink.query['response-content-disposition'], link);
            });

            return null;
          });
      });

      it('returns download partial renamed URLs: public', async function test() {
        const response = await this.amqp.publishAndWait(route, {
          uploadId: this.response.uploadId,
          types: ['c-preview'],
          rename: true,
        }, {
          headers: {
            'x-cappasity-source': 'cn-beijing',
          },
        });

        assert.ok(response.uploadId);
        assert.ok(response.files);
        assert.ok(response.urls);

        response.urls.forEach((link, idx) => {
          // check that we only have c-bin
          assert.equal(response.files[idx].type, 'c-preview');

          const parsedLink = url.parse(link, true);
          assert.equal(parsedLink.protocol, 'https:', link);
          assert.equal(parsedLink.host, '3dshot.cn-beijing.aliyuncs.com', link);
          assert.equal(parsedLink.pathname, `/${encodeURI(response.files[idx].filename, false)}`, link);
          assert.ok(parsedLink.query.OSSAccessKeyId, link);
          assert.ok(parsedLink.query.Expires, link);
          assert.ok(parsedLink.query.Signature, link);
          assert.ok(parsedLink.query['response-content-disposition'], link);
        });
      });
    });
  });
});
