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

  it('400 on if one of the fields length exceeds 50 chars', async () => {
    const req = this.send(route, {
      fileId: this.response.uploadId,
      fields: [
        250,
      ],
    });

    await assert.rejects(req, {
      statusCode: 400,
      message: 'data validation failed: data.fields[0] should be string',
    });
  });

  it('400 on if one of the fields length exceeds 50 chars', async () => {
    const req = this.send(route, {
      fileId: this.response.uploadId,
      fields: [
        'a'.repeat(51),
      ],
    });

    await assert.rejects(req, {
      statusCode: 400,
      message: 'data validation failed: data.fields[0] should NOT be longer than 50 characters',
    });
  });

  it('400 on additional param', async () => {
    const req = this.send(route, { fileId: this.response.uploadId, newParam: true });

    await assert.rejects(req, {
      statusCode: 417,
      message: 'data validation failed: data should NOT have additional properties',
    });
  });

  it('returns only upload id if no fields provided', async () => {
    const { file } = await this.send(route, { fileId: this.response.uploadId });

    assert.equal(file.uploadId, this.response.uploadId);
    assert.equal(Object.getOwnPropertyNames(file).length, 1);
  });

  it('returns requested fields with uploadId', async () => {
    const { file } = await this.send(route, { fileId: this.response.uploadId, fields: ['owner'] });

    assert.equal(file.owner, owner);
    assert.equal(file.uploadId, this.response.uploadId);
    assert.equal(Object.getOwnPropertyNames(file).length, 2);
  });

  it('returns data even if file is private', async () => {
    await updateAccess.call(this, this.response.uploadId, owner, false);
    const { file } = await this.send(route, { fileId: this.response.uploadId, fields: ['owner'] });

    assert.equal(file.owner, owner);
    assert.equal(file.uploadId, this.response.uploadId);
    assert.equal(Object.getOwnPropertyNames(file).length, 2);
  });
});
