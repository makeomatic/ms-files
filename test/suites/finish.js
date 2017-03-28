const Promise = require('bluebird');
const assert = require('assert');
const md5 = require('md5');
const uuid = require('uuid');

// helpers
const {
  startService,
  stopService,
  inspectPromise,
  modelData,
  owner,
  bindSend,
  initUpload,
} = require('../helpers/utils.js');

// data
const route = 'files.finish';

describe('finish upload suite', function suite() {
  // setup functions
  before('start service', startService);
  before('prepare upload', initUpload(modelData));
  before('helpers', bindSend(route));

  // tear-down
  after('stop service', stopService);

  // tests
  it('return 400 on invalid filename', function test() {
    return this
      .send({ filename: 'random name' })
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert.equal(err.name, 'ValidationError');
        return null;
      });
  });

  it('returns 200: 404 on missing filename', function test() {
    return this
      .send({ filename: [md5(owner), uuid.v4(), uuid.v4()].join('/') })
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert.equal(err.statusCode, 200);
        assert.ok(/^404: /.test(err.message));
        return null;
      });
  });

  it('returns progress and 409 on repeated notification', function test() {
    const [file] = this.response.files;
    return Promise
      .resolve([file, file])
      .map((_, idx) => (
        this.send({ filename: file.filename })
          .reflect()
          .then(inspectPromise(false))
          .then((err) => {
            if (idx === 0) {
              assert.equal(err.statusCode, 202);
              assert.equal(err.message, `1/${this.response.files.length} uploaded`);
            } else {
              assert.equal(err.statusCode, 200);
              assert.equal(err.message, '412: upload was already processed');
            }

            return null;
          })
      ));
  });

  it('returns progress until all files have uploaded', function test() {
    const files = this.response.files.slice(1, 3);
    return Promise
      .resolve(files)
      .mapSeries((file, idx) => {
        return this
          .send({ filename: file.filename })
          .reflect()
          .then(inspectPromise(false))
          .then((err) => {
            assert.equal(err.statusCode, 202);
            assert.equal(err.message, `${idx + 2}/${this.response.files.length} uploaded`);
            return null;
          });
      });
  });

  it('returns "upload was already processed" for subsequent messages', function test() {
    const files = this.response.files.slice(0, 3);
    return Promise
      .resolve(files)
      .mapSeries((file) => {
        return this
          .send({ filename: file.filename })
          .reflect()
          .then(inspectPromise(false))
          .then((err) => {
            assert.equal(err.statusCode, 200);
            assert.ok(/^412: /.test(err.message));
            return null;
          });
      });
  });

  it('returns "upload completed, processing skipped" on final part', function test() {
    const file = this.response.files[3];
    return this
      .send({ filename: file.filename, skipProcessing: true })
      .reflect()
      .then(inspectPromise())
      .then((response) => {
        assert.equal(response, 'upload completed, processing skipped');
        return null;
      });
  });

  describe('directOnly upload public model', function directOnlySuite() {
    before('prepare upload of directOnly file', initUpload({
      ...modelData,
      message: {
        ...modelData.message,
        directOnly: true,
      },
    }));

    it('finishes upload', function test() {
      const total = this.response.files.length;
      return Promise
        .resolve(this.response.files)
        .mapSeries((file, idx) => (
          this
            .send({ filename: file.filename, await: true })
            .reflect()
            .then(inspectPromise(idx === total - 1))
        ));
    });

    it('list does not return this file from public list', function test() {
      return this.amqp.publishAndWait('files.list', {
        isPublic: true,
        username: modelData.message.username,
      })
      .reflect()
      .then(inspectPromise())
      .get('files')
      .then((response) => {
        const directUpload = response.find(it => it.id === this.response.uploadId);
        assert.ifError(directUpload, 'direct upload was returned from public list');
        return null;
      });
    });

    it('list does not return this file for private list', function test() {
      return this.amqp.publishAndWait('files.list', {
        isPublic: false,
        username: modelData.message.username,
      })
      .reflect()
      .then(inspectPromise())
      .get('files')
      .then((response) => {
        const directUpload = response.find(it => it.id === this.response.uploadId);
        assert.ok(directUpload, 'direct upload was correctly returned');
        return null;
      });
    });
  });
});
