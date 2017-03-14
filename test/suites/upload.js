const assert = require('assert');
const md5 = require('md5');
const url = require('url');
const request = require('request-promise');
const clone = require('lodash/cloneDeep');

describe('upload suite', function suite() {
  // helpers
  const {
    startService,
    stopService,
    inspectPromise,
    config,
    bindSend,
    uploadFiles,
    modelData,
    simpleData,
    simplePackedData,
    owner,
    finishUpload,
    processUpload,
    getInfo,
  } = require('../helpers/utils.js');

  // data
  const route = 'files.upload';
  const bucketName = config.transport[0].options.bucket.name;
  const { STATUS_PENDING, STATUS_PROCESSED, FILES_PACKED_FIELD } = require('../../src/constant.js');

  // setup functions
  before('start service', startService);
  after('stop service', stopService);
  before('helpers', bindSend(route));

  describe('resumable upload suite', function resumableUploadSuite() {
    it('verifies input data and rejects on invalid format', function test() {
      return this
        .send({ ...modelData.message, username: false })
        .reflect()
        .then(inspectPromise(false));
    });

    it('rejects upload if meta.alias is specified', function test() {
      return this
        .send({
          ...modelData.message,
          meta: {
            ...modelData.message.meta,
            alias: 'sample-alias',
          },
        })
        .reflect()
        .then(inspectPromise(false));
    });

    it('initiates upload and returns correct response format', function test() {
      const message = modelData.message;

      return this
        .send(message, 45000)
        .reflect()
        .then(inspectPromise())
        .then((rsp) => {
          assert.equal(rsp.name, message.meta.name);
          assert.equal(rsp.owner, message.username);
          assert.ok(rsp.uploadId);
          assert.ok(rsp.startedAt);
          assert.ok(rsp.files);
          assert.ifError(rsp.public);
          assert.equal(rsp.status, STATUS_PENDING);
          assert.equal(rsp.parts, message.files.length);
          assert.deepEqual(rsp.controlsData, message.meta.controlsData);

          // verify that location is present
          rsp.files.forEach((part) => {
            assert.ok(part.location);

            // verify upoad link
            const location = url.parse(part.location, true);
            assert.equal(location.protocol, 'https:');
            assert.equal(location.hostname, 'www.googleapis.com');
            assert.equal(location.pathname, `/upload/storage/v1/b/${bucketName}/o`);
            assert.equal(location.query.name, part.filename);
            assert.equal(location.query.uploadType, 'resumable');
            assert.ok(location.query.upload_id);

            // verify that filename contains multiple parts
            const [ownerHash, uploadId, filename] = part.filename.split('/');
            assert.equal(md5(owner), ownerHash);
            assert.equal(rsp.uploadId, uploadId);
            assert.ok(filename);
          });

          // save for the next
          this.response = rsp;
          return null;
        });
    });

    it('upload is possible based on the returned data', function test() {
      return uploadFiles(modelData, this.response)
        .reflect()
        .then(inspectPromise())
        .map((resp) => {
          assert.equal(resp.statusCode, 200);
          return null;
        });
    });

    it('initiates public upload and returns correct response format', function test() {
      const message = modelData.message;

      return this
        .send({
          ...message,
          access: {
            setPublic: true,
          },
        }, 45000)
        .reflect()
        .then(inspectPromise())
        .then((rsp) => {
          assert.equal(rsp.name, message.meta.name);
          assert.equal(rsp.owner, message.username);
          assert.ok(rsp.uploadId);
          assert.ok(rsp.startedAt);
          assert.ok(rsp.files);
          assert.ok(rsp.public);
          assert.equal(rsp.status, STATUS_PENDING);
          assert.equal(rsp.parts, message.files.length);

          // verify that location is present
          rsp.files.forEach((part) => {
            assert.ok(part.location);

            // verify upoad link
            const location = url.parse(part.location, true);
            assert.equal(location.protocol, 'https:');
            assert.equal(location.hostname, 'www.googleapis.com');
            assert.equal(location.pathname, `/upload/storage/v1/b/${bucketName}/o`);
            assert.equal(location.query.name, part.filename);
            assert.equal(location.query.uploadType, 'resumable');
            assert.ok(location.query.upload_id);

            // verify that filename contains multiple parts
            const [ownerHash, uploadId, filename] = part.filename.split('/');
            assert.equal(md5(owner), ownerHash);
            assert.equal(rsp.uploadId, uploadId);
            assert.ok(filename);
          });

          // save for the next
          this.response = rsp;
          return null;
        });
    });

    it('upload is possible based on the returned data: public', function test() {
      return uploadFiles(modelData, this.response)
        .reflect()
        .then(inspectPromise())
        .map((resp) => {
          assert.equal(resp.statusCode, 200);
          return null;
        });
    });

    it('able to download public files right away', function test() {
      const file = this.response.files[0];
      return request.get(`https://storage.googleapis.com/${bucketName}/${file.filename}`);
    });
  });

  describe('packed upload with post-action', function suitePacked() {
    const data = clone(simplePackedData);
    const message = data.message;
    let response;

    it('rejects packed upload with invalid postAction', function test() {
      return this
        .send({
          ...message,
          access: { setPublic: true },
          uploadType: 'simple',
          postAction: {},
        })
        .reflect()
        .then(inspectPromise(false))
        .then((err) => {
          assert.equal(err.code, 400);
          assert.equal(err.name, 'ValidationError');
          return null;
        });
    });

    it('rejects packed upload with no properties in update postAction', function test() {
      return this
        .send({
          ...message,
          access: { setPublic: true },
          uploadType: 'simple',
          postAction: {
            update: {},
          },
        })
        .reflect()
        .then(inspectPromise(false))
        .then((err) => {
          assert.equal(err.code, 400);
          assert.equal(err.name, 'ValidationError');
          return null;
        });
    });

    it('creates upload with valid post-action', function test() {
      return this
        .send({
          ...message,
          access: { setPublic: true },
          uploadType: 'simple',
          postAction: {
            update: {
              alias: 'bananza',
            },
          },
        })
        .reflect()
        .then(inspectPromise())
        .then((rsp) => {
          response = rsp;
          return null;
        });
    });

    it('uploads data', function test() {
      return uploadFiles(data, response)
        .reflect()
        .then(inspectPromise())
        .map((resp) => {
          assert.equal(resp.statusCode, 200);
          return null;
        });
    });

    it('finishes upload', function test() {
      return finishUpload.call(this, response);
    });

    it('processes upload and invokes post-action', function test() {
      return processUpload.call(this, response, { awaitPostActions: true });
    });

    it('info returns data based on alias', function test() {
      return getInfo
        .call(this, { filename: 'bananza', username: message.username })
        .reflect()
        .then(inspectPromise())
        .then((rsp) => {
          assert.equal(rsp.status, STATUS_PROCESSED);
          assert.equal(rsp[FILES_PACKED_FIELD], '1');
          return null;
        });
    });
  });

  describe('signed url', function signedURLSuite() {
    let response;

    it('initiates signed URL upload', function test() {
      const { message } = simpleData;

      return this
        .send({
          ...message,
          resumable: false,
          access: {
            setPublic: true,
          },
          uploadType: 'simple',
        })
        .reflect()
        .then(inspectPromise())
        .then((rsp) => {
          assert.equal(rsp.name, message.meta.name);
          assert.equal(rsp.owner, message.username);
          assert.ok(rsp.uploadId);
          assert.ok(rsp.startedAt);
          assert.ok(rsp.files);
          assert.ok(rsp.public);
          assert.equal(rsp.status, STATUS_PENDING);
          assert.equal(rsp.parts, message.files.length);

          // verify that location is present
          rsp.files.forEach((part) => {
            assert.ok(part.location);

            // verify upload link
            const location = url.parse(part.location, true);
            assert.equal(location.protocol, 'https:');
            assert.equal(location.hostname, 'storage.googleapis.com');
            assert.equal(decodeURIComponent(location.pathname), `/${bucketName}/${part.filename}`);
            assert.ok(location.query.GoogleAccessId);
            assert.ok(location.query.Signature);
            assert.ok(location.query.Expires);

            // verify that filename contains multiple parts
            const [ownerHash, uploadId, filename] = part.filename.split('/');
            assert.equal(md5(owner), ownerHash);
            assert.equal(rsp.uploadId, uploadId);
            assert.ok(filename);
          });

          // save for the next
          response = rsp;
          return null;
        });
    });

    it('able to upload files', function test() {
      return uploadFiles(simpleData, response)
        .reflect()
        .then(inspectPromise())
        .map((resp) => {
          assert.equal(resp.statusCode, 200);
          return null;
        });
    });

    it('should fail when trying to upload non-resumable upload with resumable modifiers', function type() {
      const { message } = simpleData;

      return this
        .send({
          ...message,
          resumable: false,
          access: {
            setPublic: true,
          },
          unlisted: true,
          temp: true,
        })
        .reflect()
        .then(inspectPromise(false));
    });
  });
});
