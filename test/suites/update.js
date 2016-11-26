const assert = require('assert');
const uuid = require('uuid');
const faker = require('faker');

const {
  startService,
  stopService,
  inspectPromise,
  owner,
  modelData,
  bindSend,
  initAndUpload,
  processUpload,
  downloadFile,
  getInfo,
  meta,
  backgroundData,
} = require('../helpers/utils.js');

const route = 'files.update';
const username = owner;

describe('update suite', function suite() {
  before('start service', startService);
  before('pre-upload file', initAndUpload(modelData));
  before('helpers', bindSend(route));
  after('stop service', stopService);

  it('returns 404 when file not found', function test() {
    return this
      .send({ uploadId: uuid.v4(), username, meta })
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert.equal(err.statusCode, 404);
      });
  });

  it('returns 412 when file is not processed', function test() {
    return this
      .send({ uploadId: this.response.uploadId, username, meta }, 45000)
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert.equal(err.statusCode, 412);
      });
  });

  describe('process update', function processedSuite() {
    before('process', function pretest() {
      return processUpload.call(this, this.response);
    });

    it('initiates update and returns correct response format', function test() {
      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .reflect()
        .then(inspectPromise())
        .then((result) => {
          assert.equal(result, true);
        });
    });
  });

  describe('process info', function afterUpdateSuite() {
    it('returns file info', function test() {
      getInfo.call(this, {
        filename: this.response.uploadId,
        username,
      })
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        assert.equal(result.username, username);
        assert.equal(result.file.uploadId, this.response.uploadId);
        assert.equal(result.file.name, meta.name);
        assert.equal(result.file.description, meta.description);
        assert.equal(result.file.website, meta.website);
        assert.deepEqual(result.file.tags, meta.tags);
      });
    });
  });

  describe('assign alias', function assignAliasSuite() {
    it('creates new alias', function test() {
      return this
        .send({ uploadId: this.response.uploadId, username, meta: { alias: 'sku' } }, 15000)
        .reflect()
        .then(inspectPromise())
        .then((result) => {
          assert.equal(result, true);

          return getInfo.call(this, {
            filename: 'sku',
            username,
          })
          .tap((verifyResult) => {
            assert.equal(verifyResult.file.alias, 'sku');
            assert.equal(verifyResult.file.uploadId, this.response.uploadId);
          });
        });
    });

    it('rejects on conflict', function test() {
      // even-though we update the same model to the same alias, 409 is correct
      // and is sufficient, since it makes no sense to do noop update here
      return this
        .send({ uploadId: this.response.uploadId, username, meta: { alias: 'sku' } }, 15000)
        .reflect()
        .then(inspectPromise(false))
        .then((error) => {
          assert.equal(error.statusCode, 409);
        });
    });

    it('allows to update to another alias', function test() {
      // even-though we update the same model to the same alias, 409 is correct
      // and is sufficient, since it makes no sense to do noop update here
      return this
        .send({ uploadId: this.response.uploadId, username, meta: { alias: 'skubidoo' } }, 15000)
        .reflect()
        .then(inspectPromise())
        .then((result) => {
          assert.equal(result, true);

          return getInfo.call(this, {
            filename: 'skubidoo',
            username,
          })
          .tap((verifyResult) => {
            assert.equal(verifyResult.file.alias, 'skubidoo');
            assert.equal(verifyResult.file.uploadId, this.response.uploadId);
          });
        });
    });

    it('removes alias', function test() {
      // even-though we update the same model to the same alias, 409 is correct
      // and is sufficient, since it makes no sense to do noop update here
      return this
        .send({ uploadId: this.response.uploadId, username, meta: { alias: '' } }, 15000)
        .reflect()
        .then(inspectPromise())
        .then((result) => {
          assert.equal(result, true);

          return getInfo.call(this, {
            filename: 'skubidoo',
            username,
          })
          .reflect()
          .then(inspectPromise(false))
          .tap((error) => {
            assert.equal(error.statusCode, 404);
          });
        });
    });

    it('allows to use the same alias', function test() {
      // even-though we update the same model to the same alias, 409 is correct
      // and is sufficient, since it makes no sense to do noop update here
      return this
        .send({ uploadId: this.response.uploadId, username, meta: { alias: 'skubidoo' } }, 15000)
        .reflect()
        .then(inspectPromise())
        .then((result) => {
          assert.equal(result, true);

          return getInfo.call(this, {
            filename: 'skubidoo',
            username,
          })
          .tap((verifyResult) => {
            assert.equal(verifyResult.file.alias, 'skubidoo');
            assert.equal(verifyResult.file.uploadId, this.response.uploadId);
          });
        });
    });
  });

  describe('process update again', function afterUpdateSuite() {
    it('initiates update again with other tags', function test() {
      meta.tags = ['tag4', 'tag5', 'tag6'];

      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .reflect()
        .then(inspectPromise())
        .then((result) => {
          assert.equal(result, true);

          return getInfo.call(this, {
            filename: this.response.uploadId,
            username,
          })
          .tap((verifyResult) => {
            assert.deepEqual(verifyResult.file.tags, meta.tags);
          });
        });
    });

    it('update background color', function test() {
      meta.backgroundColor = '#00ffFa';

      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .reflect()
        .then(inspectPromise())
        .then((result) => {
          assert.equal(result, true);

          return getInfo.call(this, {
            filename: this.response.uploadId,
            username,
          })
          .tap((verifyResult) => {
            assert.equal(verifyResult.file.backgroundColor, meta.backgroundColor);
          });
        });
    });
  });

  describe('update background image', function afterUpdateSuite() {
    before('upload background image', function upload() {
      return initAndUpload(backgroundData, false).call(this)
        .then(downloadFile.bind(this))
        .then(({ urls }) => {
          meta.backgroundImage = urls[0];
        });
    });

    it('update background image', function test() {
      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .reflect()
        .then(inspectPromise())
        .then((result) => {
          assert.equal(result, true);

          return getInfo.call(this, {
            filename: this.response.uploadId,
            username,
          })
          .tap((verifyResult) => {
            assert.equal(verifyResult.file.backgroundImage, meta.backgroundImage);
          });
        });
    });

    it('able to unset backgroundImage passing an empty string', function test() {
      meta.backgroundImage = '';
      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .reflect()
        .then(inspectPromise())
        .then((result) => {
          assert.equal(result, true);

          return getInfo.call(this, {
            filename: this.response.uploadId,
            username,
          })
          .tap((verifyResult) => {
            assert.equal(verifyResult.file.backgroundImage, meta.backgroundImage);
          });
        });
    });

    it('failed to update background image due to wrong origin', function test() {
      meta.backgroundImage = faker.image.imageUrl();
      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .reflect()
        .then(inspectPromise(false))
        .then((err) => {
          assert.equal(err.statusCode, 412);
        });
    });
  });
});
