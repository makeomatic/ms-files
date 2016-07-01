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
      .then(err => {
        assert.equal(err.name, 'ValidationError');
      });
  });

  it('returns 200: 404 on missing filename', function test() {
    return this
      .send({ filename: [md5(owner), uuid.v4(), uuid.v4()].join('/') })
      .reflect()
      .then(inspectPromise(false))
      .then(err => {
        assert.equal(err.statusCode, 200);
        assert.ok(/^404: /.test(err.message));
      });
  });

  it('returns progress until all files have uploaded', function test() {
    const files = this.response.files.slice(0, 3);
    return Promise
      .resolve(files)
      .mapSeries((file, idx) => {
        return this
          .send({ filename: file.filename })
          .reflect()
          .then(inspectPromise(false))
          .then(err => {
            assert.equal(err.statusCode, 202);
            assert.equal(err.message, `${idx + 1}/${this.response.files.length} uploaded`);
          });
      });
  });

  it('returns "upload was already processed" for subsequent messages', function test() {
    const files = this.response.files.slice(0, 3);
    return Promise
      .resolve(files)
      .mapSeries(file => {
        return this
          .send({ filename: file.filename })
          .reflect()
          .then(inspectPromise(false))
          .then(err => {
            assert.equal(err.statusCode, 200);
            assert.ok(/^412: /.test(err.message));
          });
      });
  });

  it('returns "upload completed, processing skipped" on final part', function test() {
    const file = this.response.files[3];
    return this
      .send({ filename: file.filename, skipProcessing: true })
      .reflect()
      .then(inspectPromise())
      .then(response => {
        assert.equal(response, 'upload completed, proessing skipped');
      });
  });
});
