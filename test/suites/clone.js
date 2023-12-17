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
  let secondFile;

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

    secondFile = await initAndUpload({
      ...modelData,
      message: {
        ...modelData.message,
        access: {
          setPublic: true,
        },
      },
    }).call(this.files);
    await processUpload.call(this.files, secondFile);
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

  describe('clone', function cloneModel() {
    it('should clone model', async function test() {
      const response = await this.send({
        uploadId: file.uploadId,
        username: owner,
        meta: {},
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
    });
  });

  describe('list and report', function listAndReportSuite() {
    it('lists public cloned models', async function checkListSuite() {
      const { files: response } = await this.amqp.publishAndWait('files.list', {
        public: true,
        username: file.owner,
      });

      assert.strictEqual(response.length, 1);
    });

    it('lists private cloned models', async function checkListSuite() {
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

      assert.strictEqual(response.length, 1);
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

      assert.strictEqual(response.length, 1);
      assert.strictEqual(response[0].isClone, '1');
    });

    it('report endpoint returns stats for public & private models', async function test() {
      const response = await this.amqp.publishAndWait('files.report', {
        username: file.owner,
        includeStorage: true,
      });

      assert.equal(response.total, 3);
      assert.equal(response.public, 1);
      assert.equal(response.totalContentLength, 1901153 * 3);
      assert.equal(response.publicContentLength, 1901153);
    });
  });
});
