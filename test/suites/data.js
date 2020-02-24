const assert = require('assert');
const uuid = require('uuid');

const {
  startService,
  stopService,
  owner,
  modelData,
  finishUpload,
  processUpload,
  initUpload,
  updateAccess,
} = require('../helpers/utils.js');

const route = 'files.data';

describe('data suite', () => {
  before('start service', startService.bind(this));

  before('init upload', async () => {
    const uploadFn = initUpload.call(this, modelData);
    await uploadFn.call(this);
    await finishUpload.call(this, this.response);
    await processUpload.call(this, this.response);
  });

  after('stop service', stopService.bind(this));

  it('404 on missing file', async () => {
    const req = this.send(route, { fileId: uuid.v4() });
    await assert.rejects(req, { statusCode: 404 });
  });

  it('400 on invalid fileId', async () => {
    const req = this.send(route, { fileId: false });
    await assert.rejects(req, {
      statusCode: 400,
      message: /fileId/,
    });
  });

  it('400 on invalid fields param', async () => {
    const req = this.send(route, { fileId: this.response.uploadId, fields: 'string' });
    await assert.rejects(req, {
      statusCode: 400,
      message: 'data validation failed: data.fields should be array',
    });
  });

  it('400 on empty fields param', async () => {
    const req = this.send(route, { fileId: this.response.uploadId, fields: [] });
    await assert.rejects(req, {
      statusCode: 400,
      message: 'data validation failed: data.fields should NOT have fewer than 1 items',
    });
  });

  it('returns only upload id if no fields provided', async () => {
    const { file } = await this.send(route, { fileId: this.response.uploadId });
    assert.equal(file.uploadId, this.response.uploadId);
    assert.equal(Object.getOwnPropertyNames(file).length, 1);
  });

  it('returns only requested fields', async () => {
    const { file } = await this.send(route, { fileId: this.response.uploadId, fields: ['uploadId', 'owner'] });
    assert.equal(file.owner, owner);
    assert.equal(file.uploadId, this.response.uploadId);
    assert.equal(Object.getOwnPropertyNames(file).length, 2);
  });

  it('returns data even if model private', async () => {
    await updateAccess.call(this, this.response.uploadId, owner, false);
    const { file } = await this.send(route, { fileId: this.response.uploadId, fields: ['uploadId', 'owner'] });
    assert.equal(file.owner, owner);
    assert.equal(file.uploadId, this.response.uploadId);
    assert.equal(Object.getOwnPropertyNames(file).length, 2);
  });

  // Yes this method should execute same hook as files.info
  it('executes files:info:post hook', async () => {
    const spy = this.files.config.hooks['files:info:post'];
    spy.resetHistory();
    const { file } = await this.send(route, { fileId: this.response.uploadId, fields: ['uploadId', 'owner', 'computedVersion'] });
    const spyCalls = spy.getCalls();
    const fileArg = spyCalls[0].lastArg;

    assert.equal(spyCalls.length, 1, true);
    assert.equal(fileArg.uploadId, file.uploadId);
  });
});
