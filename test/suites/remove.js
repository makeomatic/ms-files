const { HttpStatusError } = require('@microfleet/validation');
const Promise = require('bluebird');
const assert = require('assert');
const uuid = require('uuid');
const { rejects } = require('assert');

// helpers
const {
  startService,
  stopService,
  owner,
  modelData,
  bindSend,
  initAndUpload,
  processUpload,
} = require('../helpers/utils');

const MissingError = new HttpStatusError(404, '404: could not find upload');
const route = 'files.remove';

describe('remove suite', function suite() {
  // setup functions
  before('start service', startService);
  // sets `this.response` to `files.finish` response
  before('pre-upload file', initAndUpload(modelData));
  before('helpers', bindSend(route));

  // tear-down
  after('stop service', stopService);

  //
  it('404 on missing filename/upload-id', function test() {
    return assert.rejects(this.send({ filename: uuid.v4(), username: owner }), {
      name: 'HttpStatusError',
      statusCode: 404,
    });
  });

  it('403 on invalid user id', function test() {
    return assert.rejects(this.send({
      filename: this.response.uploadId,
      username: 'martial@arts.com',
    }), {
      name: 'HttpStatusError',
      statusCode: 403,
    });
  });

  it('removes file data', function test() {
    return this.send({ filename: this.response.uploadId, username: owner });
  });

  it('waits a bit.... 3seconds', () => Promise.delay(3000));

  it('404 on subsequent remove', function test() {
    return assert.rejects(this.send({ filename: this.response.uploadId, username: owner }), {
      statusCode: 404,
    });
  });
});

describe('soft delete', function suite() {
  // setup functions
  before('start service', startService);
  // sets `this.response` to `files.finish` response
  before('pre-upload file', initAndUpload(modelData));
  before('helpers', bindSend(route));

  // tear-down
  after('stop service', stopService);

  it('removes files info from redis but not files', async function test() {
    await this.send({ filename: this.response.uploadId, username: owner, softDelete: true });
  });

  it('get files from storage for removed item', async function test() {
    await Promise.all(this.response.files.map(async (file) => {
      const exists = await this.files.providers[0].exists(file.filename);
      assert.equal(exists, true, MissingError);
    }));
  });
});

describe('immutable/referenced block', function suite() {
  // setup functions
  before('start service', startService);
  // sets `this.response` to `files.finish` response
  beforeEach('pre-upload file', initAndUpload(modelData));
  before('helpers', bindSend(route));

  // tear-down
  after('stop service', stopService);

  it('remove of the immutable model is denied', async function test() {
    await processUpload.call(this.files, this.response);
    await this.amqp.publishAndWait('files.update', {
      uploadId: this.response.uploadId,
      username: owner,
      immutable: true,
      includeReferences: true,
      meta: {},
    });

    await rejects(this.send({ filename: this.response.uploadId, username: owner }), /should not be immutable object/);
  });

  it('remove of the referenced model is denied', async function test() {
    const secondFile = await initAndUpload(modelData).call(this.files);
    await processUpload.call(this.files, this.response);
    await processUpload.call(this.files, secondFile);

    await this.amqp.publishAndWait('files.update', {
      uploadId: this.response.uploadId,
      username: owner,
      immutable: true,
      includeReferences: false,
      meta: {
        references: [secondFile.uploadId],
      },
    });

    await rejects(this.send({ filename: secondFile.uploadId, username: owner }), /should not be referenced/);
  });
});
