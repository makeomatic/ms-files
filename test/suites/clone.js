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

  it('should clone model', async function test() {
    const response = await this.send({
      uploadId: file.uploadId,
      username: owner,
    });

    console.debug('== clone response', response);

    const clonedModel = await this.amqp.publishAndWait('files.info', {
      filename: response.uploadId,
      username: file.owner,
    });

    console.debug('=== orig model', file);
    console.debug('=== cloned model', clonedModel.file);
  });

  describe.skip('directOnly upload public model', function directOnlySuite() {
    it('list does not return this file from public list', async function test() {
      const { files: response } = await this.amqp.publishAndWait('files.list', {
        public: true,
        username: modelData.message.username,
      });

      const directUpload = response.find((it) => it.id === this.response.uploadId);
      assert.ifError(directUpload, 'direct upload was returned from public list');
    });

    it('list returns this file for private list', async function test() {
      const { files: response } = await this.amqp.publishAndWait('files.list', {
        public: false,
        username: modelData.message.username,
      });

      const directUpload = response.find((it) => it.id === this.response.uploadId);
      assert.ok(directUpload, 'direct upload was correctly returned');
    });

    it('report endpoint returns stats for public & private models', function test() {
      return this
        .amqp
        .publishAndWait('files.report', {
          username: modelData.message.username,
          includeStorage: true,
        })
        .then((response) => {
          assert.equal(response.total, 1);
          assert.equal(response.public, 0);
          assert.equal(response.totalContentLength, 1901153);
          assert.equal(response.publicContentLength, 0);
          return null;
        });
    });
  });
});
