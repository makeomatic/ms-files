const assert = require('assert');
const uuid = require('uuid');
const { faker } = require('@faker-js/faker');
const clone = require('rfdc')();

const {
  startService,
  stopService,
  owner,
  modelData,
  bindSend,
  initAndUpload,
  processUpload,
  downloadFile,
  getInfo,
  meta: _meta,
  backgroundData,
} = require('../helpers/utils');

const meta = clone(_meta);
const route = 'files.update';
const username = owner;

describe('update suite', function suite() {
  before('start service', async function startAll() {
    await startService.call(this);
  });
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

  it('returns 404 when file not found', async function test() {
    await assert.rejects(this.send({ uploadId: uuid.v4(), username, meta }), {
      statusCode: 404,
    });
  });

  it('returns 412 when file is not processed', async function test() {
    await assert.rejects(this.send({ uploadId: this.response.uploadId, username, meta }, 45000), {
      statusCode: 412,
    });
  });

  describe('process update', function processedSuite() {
    before('process', function pretest() {
      return processUpload.call(this, this.response);
    });

    it('initiates update and returns correct response format', function test() {
      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
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
        .then(async (result) => {
          assert.equal(result, true);

          const verifyResult = await getInfo.call(this, {
            filename: 'sku',
            username,
          });

          assert.equal(verifyResult.file.alias, 'sku');
          assert.equal(verifyResult.file.uploadId, this.response.uploadId);
        });
    });

    it('rejects on conflict', async function test() {
      // even-though we update the same model to the same alias, 409 is correct
      // and is sufficient, since it makes no sense to do noop update here
      await assert.rejects(this.send({ uploadId: this.response.uploadId, username, meta: { alias: 'sku' } }, 15000), {
        statusCode: 409,
      });
    });

    it('allows to update to another alias', function test() {
      // even-though we update the same model to the same alias, 409 is correct
      // and is sufficient, since it makes no sense to do noop update here
      return this
        .send({ uploadId: this.response.uploadId, username, meta: { alias: 'skubidoo' } }, 15000)
        .then(async (result) => {
          assert.equal(result, true);

          const verifyResult = await getInfo.call(this, {
            filename: 'skubidoo',
            username,
          });

          assert.equal(verifyResult.file.alias, 'skubidoo');
          assert.equal(verifyResult.file.uploadId, this.response.uploadId);
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
        .then((result) => {
          assert.equal(result, true);

          return assert.rejects(getInfo.call(this, {
            filename: 'skubidoo',
            username,
          }), {
            statusCode: 404,
          });
        });
    });

    it('allows to use the same alias', function test() {
      // even-though we update the same model to the same alias, 409 is correct
      // and is sufficient, since it makes no sense to do noop update here
      return this
        .send({ uploadId: this.response.uploadId, username, meta: { alias: 'skubidoo' } }, 15000)
        .then(async (result) => {
          assert.equal(result, true);

          const verifyResult = await getInfo.call(this, {
            filename: 'skubidoo',
            username,
          });

          assert.equal(verifyResult.file.alias, 'skubidoo');
          assert.equal(verifyResult.file.uploadId, this.response.uploadId);
        });
    });
  });

  describe('process update again', function afterUpdateSuite() {
    it('initiates update again with other tags', function test() {
      meta.tags = ['tag4', 'tag5', 'tag6'];

      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .then(async (result) => {
          assert.equal(result, true);

          const verifyResult = await getInfo.call(this, {
            filename: this.response.uploadId,
            username,
          });

          assert.deepEqual(verifyResult.file.tags, meta.tags);
        });
    });

    it('update background color (hex)', function test() {
      meta.backgroundColor = '#00ffFa';

      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .then(async (result) => {
          assert.equal(result, true);

          const verifyResult = await getInfo.call(this, {
            filename: this.response.uploadId,
            username,
          });

          assert.equal(verifyResult.file.backgroundColor, meta.backgroundColor);
        });
    });

    it('update background color (rgb)', function test() {
      meta.backgroundColor = 'rgb(255,0,0)';

      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .then(async (result) => {
          assert.equal(result, true);

          const verifyResult = await getInfo.call(this, {
            filename: this.response.uploadId,
            username,
          });

          assert.equal(verifyResult.file.backgroundColor, meta.backgroundColor);
        });
    });

    it('update background color (transparent)', function test() {
      meta.backgroundColor = 'transparent';

      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .then(async (result) => {
          assert.equal(result, true);

          const verifyResult = await getInfo.call(this, {
            filename: this.response.uploadId,
            username,
          });

          assert.equal(verifyResult.file.backgroundColor, meta.backgroundColor);
        });
    });

    it('update name sets name_n field', async function test() {
      meta.name = 'New Name';
      const updateResult = await this.send({ uploadId: this.response.uploadId, username, meta }, 45000);
      assert.equal(updateResult, true);

      const verifyResult = await getInfo.call(this, {
        filename: this.response.uploadId,
        username,
      });

      assert.equal(verifyResult.file.name, 'New Name');
      assert.equal(verifyResult.file.name_n, 'new name');
    });
  });

  describe('directOnly update', function directOnlySuite() {
    it('returns public from a list', async function test() {
      const { files } = await this.amqp.publishAndWait('files.list', {
        public: true,
        username,
      });

      const directUpload = files.find((it) => it.id === this.response.uploadId);
      assert.ok(directUpload, 'upload was not found');
    });

    it('update and set it to directOnly', function test() {
      return this.send({
        username,
        uploadId: this.response.uploadId,
        directOnly: true,
      });
    });

    it('does not return direct from a public list', async function test() {
      const { files } = await this.amqp.publishAndWait('files.list', {
        public: true,
        username,
      });

      const directUpload = files.find((it) => it.id === this.response.uploadId);
      assert.ifError(directUpload, 'direct upload was returned from public list');
    });

    it('update and set it back to default', function test() {
      return this.send({
        username,
        uploadId: this.response.uploadId,
        directOnly: false,
      });
    });

    it('returns public from a list once again', async function test() {
      const { files } = await this.amqp.publishAndWait('files.list', {
        public: true,
        username,
      });

      const directUpload = files.find((it) => it.id === this.response.uploadId);
      assert.ok(directUpload, 'upload was not found');
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

  describe('update website', function updateWebsite() {
    it('able to unset website passing an empty string', async function test() {
      const { uploadId } = this.response;
      meta.website = '';

      await this.send({
        uploadId,
        username,
        meta,
      }, 45000);

      const fileInfo = await getInfo.call(this, {
        filename: uploadId,
        username,
      });

      assert.strictEqual(fileInfo.file.website, undefined, 'Website should be unseted');
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

  describe('catalog', function catalogSuite() {
    it('should return empty categories', async function test() {
      const firstResult = await getInfo.call(this, { filename: this.response.uploadId, username });
      assert.ok(typeof firstResult.file.categories === 'undefined');

      await this.send({ uploadId: this.response.uploadId, username: owner, meta: { categories: ['_s1_c1', '_s1_c2'] } }, 45000);
      const result = await getInfo.call(this, { filename: this.response.uploadId, username });
      assert.deepEqual(result.file.categories, ['_s1_c1', '_s1_c2']);

      await this.send({ uploadId: this.response.uploadId, username: owner, meta: { categories: [] } }, 45000);
      const emptyResult = await getInfo.call(this, { filename: this.response.uploadId, username });
      assert.deepEqual(emptyResult.file.categories, []);
    });
  });

  describe('additionalContent', function catalogSuite() {
    const additionalContent = [
      {
        type: 'video',
        title: 'videoName',
        id: 'f52c0d5f-21e3-4ac2-aaf4-c736db8430d1',
        urls: {
          content: 'https://content.org',
          preview: 'https://preview.org/file.jpeg',
        },
      },
      {
        title: 'Tile',
        id: 'e5efabaf-36b0-4286-a242-1cff8f12f32d',
        owner: 'username',
        type: 'model',
      },
      {
        type: 'image',
        urls: {
          content: 'https://content.org/fds.jpeg',
          preview: 'https://preview.org/file.jpeg',
        },
        id: '7f275151-8993-4a77-b889-a9cf46a7d15a',
      },
    ];

    it('should return additionalContent', async function test() {
      const firstResult = await getInfo.call(this, { filename: this.response.uploadId, username });
      assert.ok(typeof firstResult.file.additionalContent === 'undefined');

      await this.send({ uploadId: this.response.uploadId, username: owner, meta: { additionalContent } }, 45000);
      const result = await getInfo.call(this, { filename: this.response.uploadId, username });
      assert.deepEqual(result.file.additionalContent, additionalContent);

      await this.send({ uploadId: this.response.uploadId, username: owner, meta: { additionalContent: [] } }, 45000);
      const emptyResult = await getInfo.call(this, { filename: this.response.uploadId, username });
      assert.deepEqual(emptyResult.file.additionalContent, []);
    });
  });

  describe('update nft', function emptyDescription() {
    it('update nft fields', async function test() {
      const { uploadId } = this.response;
      const nft = {
        price: '1',
        asset: 'asset',
        story: 'story',
        currency: 'usd',
        supply: 1,
        image: 'http://website.com/image.jpeg',
        attributes: [{
          title: 'test',
          type: 'image',
          url: 'http://test.com',
        }],
      };

      await this.send({
        uploadId,
        username,
        meta: {
          ...meta,
          nft,
        },
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
      assert.equal(fileInfo.file.nft.attributes[0].type, 'image');
      assert.equal(fileInfo.file.nft.attributes[0].url, 'http://test.com');
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
        .then(async (result) => {
          assert.equal(result, true);

          const verifyResult = await getInfo.call(this, {
            filename: this.response.uploadId,
            username,
          });

          assert.equal(verifyResult.file.backgroundImage, meta.backgroundImage);
        });
    });

    it('able to unset backgroundImage passing an empty string', function test() {
      meta.backgroundImage = '';
      return this
        .send({ uploadId: this.response.uploadId, username, meta }, 45000)
        .then(async (result) => {
          assert.equal(result, true);

          const verifyResult = await getInfo.call(this, {
            filename: this.response.uploadId,
            username,
          });

          assert.equal(verifyResult.file.backgroundImage, meta.backgroundImage);
        });
    });

    it('failed to update background image due to wrong origin', function test() {
      meta.backgroundImage = faker.image.imageUrl();
      return assert.rejects(this.send({ uploadId: this.response.uploadId, username, meta }, 45000), {
        statusCode: 412,
      });
    });
  });

  describe('file references', function referenceSuite() {
    let uploadId;
    let modelWithReference;

    before('upload-file', async function uploadFile() {
      meta.backgroundImage = '';
      const uploaded = await initAndUpload({
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
      }, false).call({ amqp: this.amqp });

      uploadId = uploaded.uploadId;
    });

    it('assigns reference', async function test() {
      const { amqp } = this;

      const anotherUpload = await initAndUpload({
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
      }, false).call({ amqp });

      modelWithReference = anotherUpload.uploadId;

      await this.send({
        username,
        uploadId: anotherUpload.uploadId,
        meta: {
          references: [uploadId],
        },
      });

      const updated = await getInfo.call(this, {
        filename: anotherUpload.uploadId,
        username,
      });

      assert.deepStrictEqual(updated.file.references, [uploadId]);
      assert.deepStrictEqual(updated.file.hasReferences, '1');

      const referenced = await getInfo.call(this, {
        filename: uploadId,
        username,
      });

      assert.deepStrictEqual(referenced.file.isReferenced, '1');
    });

    it('denies reference already referenced model', async function test() {
      const { amqp } = this;

      const anotherUpload = await initAndUpload({
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
      }, false).call({ amqp });

      await assert.rejects(
        this.send({
          username,
          uploadId: anotherUpload.uploadId,
          meta: {
            references: [uploadId],
          },
        }),
        (err) => {
          assert.strictEqual(err.name, 'ValidationError');
          assert.strictEqual(err.message, 'invalid reference');
          assert.strictEqual(err.errors[0].text, 'already has reference');
          assert.strictEqual(err.errors[0].field, uploadId);

          return true;
        }
      );
    });

    it('validates directOnly, nft and nested references', async function test() {
      await this.send({
        username,
        uploadId,
        immutable: true,
        meta: {
          nft: {
            price: '1',
            asset: 'asset',
            story: 'story',
            currency: 'usd',
            supply: 1,
            image: 'http://website.com/image.jpeg',
            attributes: [{
              title: 'test',
              type: 'image',
              url: 'http://test.com',
            }],
          },
        },
      });

      const anotherUpload = await initAndUpload({
        ...modelData,
        message: {
          ...modelData.message,
          meta: {
            ...meta,
            ...modelData.message.meta,
          },
        },
      }, false).call({ amqp: this.amqp });

      await assert.rejects(
        this.send({
          username,
          uploadId: anotherUpload.uploadId,
          meta: {
            references: [uploadId, modelWithReference],
          },
        }),
        (err) => {
          assert.strictEqual(err.name, 'ValidationError');
          assert.strictEqual(err.message, 'invalid reference');
          assert.strictEqual(err.errors[0].text, 'should not be special type');
          assert.strictEqual(err.errors[0].field, uploadId);
          assert.strictEqual(err.errors[1].text, 'should not be immutable');
          assert.strictEqual(err.errors[1].field, uploadId);
          assert.strictEqual(err.errors[2].text, 'already has reference');
          assert.strictEqual(err.errors[2].field, uploadId);
          assert.strictEqual(err.errors[3].text, 'should not have child references');
          assert.strictEqual(err.errors[3].field, modelWithReference);

          return true;
        }
      );
    });

    it('removes reference', async function test() {
      await this.send({
        username,
        uploadId: modelWithReference,
        meta: {
          references: [],
        },
      });

      const updated = await getInfo.call(this, {
        filename: modelWithReference,
        username,
      });

      assert.deepStrictEqual(updated.file.references, []);
      assert.strict(!updated.file.hasReferences);

      const referenced = await getInfo.call(this, {
        filename: uploadId,
        username,
      });

      assert.strict(!referenced.file.isReferenced);
    });
  });
});
