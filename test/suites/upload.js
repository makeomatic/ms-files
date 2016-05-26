const assert = require('assert');
const md5 = require('md5');
const url = require('url');
const request = require('request-promise');

// helpers
const {
  startService,
  stopService,
  inspectPromise,
  config,
  bindSend,
  uploadFiles,
  modelData,
  owner,
} = require('../helpers/utils.js');

// data
const route = 'files.upload';
const bucketName = config.transport.options.bucket.name;
const { STATUS_PENDING } = require('../../lib/constant.js');

describe('upload suite', function suite() {
  // setup functions
  before('start service', startService);
  after('stop service', stopService);
  before('helpers', bindSend(route));

  it('verifies input data and rejects on invalid format', function test() {
    return this
      .send({ ...modelData.message, username: false })
      .reflect()
      .then(inspectPromise(false));
  });

  it('initiates upload and returns correct response format', function test() {
    const message = modelData.message;

    return this
      .send(message, 45000)
      .reflect()
      .then(inspectPromise())
      .then(rsp => {
        assert.equal(rsp.name, message.meta.name);
        assert.equal(rsp.owner, message.username);
        assert.ok(rsp.uploadId);
        assert.ok(rsp.startedAt);
        assert.ok(rsp.files);
        assert.ifError(rsp.public);
        assert.equal(rsp.status, STATUS_PENDING);
        assert.equal(rsp.parts, message.files.length);

        // verify that location is present
        rsp.files.forEach(part => {
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
      });
  });

  it('upload is possible based on the returned data', function test() {
    return uploadFiles(modelData, this.response)
      .reflect()
      .then(inspectPromise())
      .map(resp => {
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
      .then(rsp => {
        assert.equal(rsp.name, message.meta.name);
        assert.equal(rsp.owner, message.username);
        assert.ok(rsp.uploadId);
        assert.ok(rsp.startedAt);
        assert.ok(rsp.files);
        assert.ok(rsp.public);
        assert.equal(rsp.status, STATUS_PENDING);
        assert.equal(rsp.parts, message.files.length);

        // verify that location is present
        rsp.files.forEach(part => {
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
      });
  });

  it('upload is possible based on the returned data: public', function test() {
    return uploadFiles(modelData, this.response)
      .reflect()
      .then(inspectPromise())
      .map(resp => {
        assert.equal(resp.statusCode, 200);
        return null;
      });
  });

  it('able to download public files right away', function test() {
    const file = this.response.files[0];
    return request.get(`https://storage.googleapis.com/${bucketName}/${file.filename}`);
  });
});
