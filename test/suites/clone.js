const assert = require('assert');
const uuid = require('uuid');

// helpers
const {
  startService,
  stopService,
  modelData,
  owner,
  initAndUpload,
  bindSend,
  processUpload,
} = require('../helpers/utils');

// data
const route = 'files.clone';

describe('clone file suite', function suite() {
  let file;

  before('override config', function overrideConfig() {
    this.configOverride = {
      redisSearch: {
        enabled: true,
      },
      migrations: {
        enabled: true,
      },
    };
  });

  before('start service', startService);

  before('upload', async function uploadFile() {
    file = await initAndUpload(modelData).call(this.files);
    await processUpload.call(this.files, file);
  });

  before('helpers', bindSend(route));

  after('stop service', stopService);

  it('return 400 on invalid request', async function test() {
    await assert.rejects(this.send({}), {
      name: 'HttpStatusError',
      statusCode: 400,
    });
  });

  it('return 400 on invalid filename', async function test() {
    await assert.rejects(this.send({ uploadId: 'random name', username: owner }), {
      name: 'HttpStatusError',
      statusCode: 400,
    });
  });

  it('returns 200: 404 on missing file', async function test() {
    await assert.rejects(
      this.send({ uploadId: uuid.v4(), username: owner }),
      /could not find associated data/
    );
  });

  it('should check whether model is immutable', async function test() {
    await assert.rejects(
      this.send({ uploadId: file.uploadId, username: owner }),
      /should be immutable object/
    );
  });

  it('should clone model', async function test() {
    await this.amqp.publishAndWait('files.update', {
      uploadId: file.uploadId,
      username: owner,
      immutable: true,
      meta: {},
    });
    const response = await this.send({
      uploadId: file.uploadId,
      username: owner,
      meta: {
        nftWallet: '0x0000000000000000000000000000000000000002',
      },
    });

    assert.ok(response.uploadId);
    assert.strictEqual(response.username, owner);

    const { file: copy } = await this.amqp.publishAndWait('files.info', {
      filename: response.uploadId,
      username: file.owner,
    });

    assert.ok(copy.clonedAt);
    assert.strictEqual(copy.owner, owner);
    assert.strictEqual(copy.parentId, file.uploadId);
    assert.strictEqual(copy.isClone, '1');
    assert.strictEqual(copy.nftWallet, '0x0000000000000000000000000000000000000002');
  });

  it('should allow to update specific metadata even if model is readonly', async function updateROFiedsSuite() {
    await this.amqp.publishAndWait('files.update', {
      uploadId: file.uploadId,
      username: owner,
      immutable: true,
      meta: {},
    });

    const { uploadId, username } = await this.send({
      uploadId: file.uploadId,
      username: owner,
    });

    await this.amqp.publishAndWait('files.update', {
      uploadId,
      username,
      meta: {
        nftWallet: '0x0000000000000000000000000000000000000001',
        nftCollection: '0x0000000000000000000000000000000000000000',
        nftToken: '0000000000000000000000000000000000000000000000000000000000',
        nftAmount: 1,
      },
    });

    const updatedData = await this.amqp.publishAndWait('files.data', {
      uploadId,
      fields: [
        'nftWallet', 'nftCollection', 'nftToken', 'nftAmount',
      ],
    });

    assert.deepStrictEqual(updatedData.file, {
      uploadId,
      nftWallet: '0x0000000000000000000000000000000000000001',
      nftCollection: '0x0000000000000000000000000000000000000000',
      nftToken: '0000000000000000000000000000000000000000000000000000000000',
      nftAmount: '1',
    });
  });

  it('lists public cloned models', async function checkListSuite() {
    const { files: response } = await this.amqp.publishAndWait('files.list', {
      public: true,
      username: file.owner,
    });

    assert.strictEqual(response.length, 0);
  });

  it('lists public cloned models', async function checkListSuite() {
    const { files: response } = await this.amqp.publishAndWait('files.list', {
      public: false,
      username: file.owner,
    });

    assert.strictEqual(response.length, 3);
  });

  it('lists all cloned models', async function checkListSuite() {
    const { files: response } = await this.amqp.publishAndWait('files.list', {
      public: false,
    });

    assert.strictEqual(response.length, 3);
  });

  it('lists all cloned models', async function checkListSuite() {
    const { files: response } = await this.amqp.publishAndWait('files.list', {
      public: true,
    });

    assert.strictEqual(response.length, 0);
  });

  it('able to find models by `hasClones`', async function checkListSuite() {
    const { files: response } = await this.amqp.publishAndWait('files.list', {
      filter: {
        hasClones: '1',
      },
    });

    assert.strictEqual(response.length, 1);
    assert.strictEqual(response[0].hasClones, '1');
  });

  it('able to find models by `isClone`', async function checkListSuite() {
    const { files: response } = await this.amqp.publishAndWait('files.list', {
      filter: {
        isClone: '1',
      },
    });

    assert.strictEqual(response.length, 2);
    assert.strictEqual(response[0].isClone, '1');
  });

  it('report endpoint returns stats for public & private models', async function test() {
    const response = await this.amqp.publishAndWait('files.report', {
      username: file.owner,
      includeStorage: true,
    });

    assert.equal(response.total, 3);
    assert.equal(response.public, 0);
    assert.equal(response.totalContentLength, 1901153 * 3);
    assert.equal(response.publicContentLength, 0);
  });
});
