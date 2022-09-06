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
} = require('../helpers/utils');

const route = 'files.update';
const username = owner;

describe('update suite', function suite() {
  before('start service', startService);
  before('pre-upload file', initAndUpload({
    ...modelData,
    message: {
      ...modelData.message,
      meta: {
        ...meta,
        ...modelData.message.meta,
      },
      access: {
        setPublic: true,
      },
    },
  }));
  before('helpers', bindSend(route));
  after('stop service', stopService);

  it('returns 404 when file not found', function test() {
    return this
      .send({ uploadId: uuid.v4(), username, meta })
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert.equal(err.statusCode, 404);
        return null;
      });
  });

  it('returns 412 when file is not processed', function test() {
    return this
      .send({ uploadId: this.response.uploadId, username, meta }, 45000)
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert.equal(err.statusCode, 412);
        return null;
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
          return null;
        });
    });
  });

  describe('process info', function afterUpdateSuite() {
    it('returns file info', function test() {
      return getInfo.call(this, {
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
          assert.deepEqual(result.file.playerSettings, meta.playerSettings);
          assert.deepEqual(result.file.creationInfo, meta.creationInfo);
          return null;
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
          return null;
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

    it('allows alias with spaces and trims them', async function test() {
      const result = await this.send({
        uploadId: this.response.uploadId,
        username,
        meta: { alias: '  skub idoo ' },
      }, 15000);

      assert.equal(result, true);

      const verifyResult = await getInfo.call(this, {
        filename: 'skub idoo',
        username,
      });

      assert.equal(verifyResult.file.alias, 'skub idoo');
      assert.equal(verifyResult.file.uploadId, this.response.uploadId);
    });

    it('throws if alias is empty after trimming', async function test() {
      let serviceError;

      try {
        await this.send({
          uploadId: this.response.uploadId,
          username,
          meta: { alias: '    ' },
        }, 15000);
      } catch (e) {
        serviceError = e;
      }

      assert.ok(serviceError, 'should throw error');
      assert(serviceError.statusCode === 400);
      assert(serviceError.message === 'empty alias after trim');
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

  describe('directOnly update', function directOnlySuite() {
    it('returns public from a list', function test() {
      return this.amqp.publishAndWait('files.list', {
        public: true,
        username,
      })
        .reflect()
        .then(inspectPromise())
        .get('files')
        .then((response) => {
          const directUpload = response.find((it) => it.id === this.response.uploadId);
          assert.ok(directUpload, 'upload was not found');
          return null;
        });
    });

    it('update and set it to directOnly', function test() {
      return this.send({
        username,
        uploadId: this.response.uploadId,
        directOnly: true,
      })
        .reflect()
        .then(inspectPromise());
    });

    it('does not return direct from a public list', function test() {
      return this.amqp.publishAndWait('files.list', {
        public: true,
        username,
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

    it('update and set it back to default', function test() {
      return this.send({
        username,
        uploadId: this.response.uploadId,
        directOnly: false,
      })
        .reflect()
        .then(inspectPromise());
    });

    it('returns public from a list once again', function test() {
      return this.amqp.publishAndWait('files.list', {
        public: true,
        username,
      })
        .reflect()
        .then(inspectPromise())
        .get('files')
        .then((response) => {
          const directUpload = response.find((it) => it.id === this.response.uploadId);
          assert.ok(directUpload, 'upload was not found');
          return null;
        });
    });
  });

  describe('Description trim and empty', function emptyDescription() {
    it('permits empty description', async function test() {
      const { uploadId } = this.response;
      meta.description = '';

      await this.send({
        uploadId,
        username,
        meta,
      }, 45000);

      const fileInfo = await getInfo.call(this, {
        filename: uploadId,
        username,
      });

      assert.strictEqual(fileInfo.file.description, '', 'Description should be empty');
    });

    it('trims description', async function test() {
      const { uploadId } = this.response;
      meta.description = ' foo ';

      await this.send({
        uploadId,
        username,
        meta,
      }, 45000);

      const fileInfo = await getInfo.call(this, {
        filename: uploadId,
        username,
      });

      assert.strictEqual(fileInfo.file.description, 'foo', 'Description should be trimmed');
    });
  });

  describe('playerSettings', function playerSettingsSuite() {
    it('able to change rotation mode', async function test() {
      const { uploadId } = this.response;
      meta.playerSettings.rotatemode = 'once';

      await this.send({ uploadId, username, meta: { playerSettings: { rotatemode: 'once' } } }, 45000);

      const fileInfo = await getInfo.call(this, { filename: uploadId, username });

      assert.deepEqual(fileInfo.file.playerSettings, meta.playerSettings);
    });

    it('able to change ttc', async function test() {
      const { uploadId } = this.response;
      meta.playerSettings.ttc = 15;

      await this.send({ uploadId, username, meta: { playerSettings: { ttc: 15 } } }, 45000);
      const fileInfo = await getInfo.call(this, { filename: uploadId, username });
      assert.deepEqual(fileInfo.file.playerSettings, meta.playerSettings);
    });

    it('able to change autorotatetime', async function test() {
      const { uploadId } = this.response;
      meta.playerSettings.autorotatetime = 30;

      await this.send({ uploadId, username, meta: { playerSettings: { autorotatetime: 30 } } }, 45000);
      const fileInfo = await getInfo.call(this, { filename: uploadId, username });
      assert.deepEqual(fileInfo.file.playerSettings, meta.playerSettings);
    });

    it('able to change beginFrame', async function test() {
      const { uploadId } = this.response;
      meta.playerSettings.beginFrame = 2;

      await this.send({ uploadId, username, meta: { playerSettings: { beginFrame: 2 } } }, 45000);
      const fileInfo = await getInfo.call(this, { filename: uploadId, username });
      assert.deepEqual(fileInfo.file.playerSettings, meta.playerSettings);
    });

    it('able to change endFrame', async function test() {
      const { uploadId } = this.response;
      meta.playerSettings.endFrame = 30;

      await this.send({ uploadId, username, meta: { playerSettings: { endFrame: 30 } } }, 45000);
      const fileInfo = await getInfo.call(this, { filename: uploadId, username });
      assert.deepEqual(fileInfo.file.playerSettings, meta.playerSettings);
    });

    it('able to change startViewFrame', async function test() {
      const { uploadId } = this.response;
      meta.playerSettings.startViewFrame = 15;

      await this.send({ uploadId, username, meta: { playerSettings: { startViewFrame: 15 } } }, 45000);
      const fileInfo = await getInfo.call(this, { filename: uploadId, username });
      assert.deepEqual(fileInfo.file.playerSettings, meta.playerSettings);
    });

    it('able to change `reverse`', async function test() {
      const { uploadId } = this.response;
      meta.playerSettings.reverse = true;

      await this.send({ uploadId, username, meta: { playerSettings: { reverse: true } } }, 45000);
      const fileInfo = await getInfo.call(this, { filename: uploadId, username });
      assert.deepEqual(fileInfo.file.playerSettings, meta.playerSettings);
    });

    it('able to change `cycle`', async function test() {
      const { uploadId } = this.response;
      meta.cycle = false;

      await this.send({ uploadId, username, meta: { cycle: false } }, 45000);
      const fileInfo = await getInfo.call(this, { filename: uploadId, username });
      assert.equal(fileInfo.file.cycle, meta.cycle);
    });
  });

  describe('update nft', function emptyDescription() {
    it('update nft fields', async function test() {
      const { uploadId } = this.response;
      meta.nft = {
        price: '1',
        asset: 'asset',
        story: 'story',
        currency: 'usd',
        supply: 1,
        image: 'http://website.com/image.jpeg',
        attributes: [{
          title: 'test',
          imageUrl: 'http://test.com',
        }],
      };

      await this.send({
        uploadId,
        username,
        meta,
      }, 45000);

      const fileInfo = await getInfo.call(this, {
        filename: uploadId,
        username,
      });

      assert.equal(fileInfo.file.nft.price, '1');
      assert.equal(fileInfo.file.nft.asset, 'asset');
      assert.equal(fileInfo.file.nft.story, 'story');
      assert.equal(fileInfo.file.nft.currency, 'usd');
      assert.equal(fileInfo.file.nft.supply, 1);
      assert.equal(fileInfo.file.nft.image, 'http://website.com/image.jpeg');
      assert.equal(fileInfo.file.nft.attributes[0].title, 'test');
      assert.equal(fileInfo.file.nft.attributes[0].imageUrl, 'http://test.com');
    });
  });

  describe('Version field is present', function emptyDescription() {
    it('file info returns version field', async function test() {
      const { uploadId } = this.response;

      const fileInfo = await getInfo.call(this, {
        filename: uploadId,
        username,
      });

      assert.strictEqual(fileInfo.file.version, '1', 'File should has version field');
    });
  });

  describe('update background image', function afterUpdateSuite() {
    before('upload background image', function upload() {
      return initAndUpload(backgroundData, false).call(this)
        .then(downloadFile.bind(this))
        .then(({ urls }) => {
          [meta.backgroundImage] = urls;
          return null;
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
          return null;
        });
    });
  });
});
