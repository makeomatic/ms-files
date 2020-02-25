const assert = require('assert');

const {
  startService,
  stopService,
  modelData,
  finishUpload,
  processUpload,
  initUpload,
} = require('../../helpers/utils.js');

const { FILES_DATA } = require('../../../src/constant');
const fetchData = require('../../../src/utils/fetch-data');

describe('util fetch-data suite', () => {
  let boundFetchData;
  let dataKey;
  before('start service', startService.bind(this));

  before('init upload', async () => {
    const uploadFn = initUpload.call(this, modelData);
    await uploadFn.call(this);
    await finishUpload.call(this, this.response);
    await processUpload.call(this, this.response);

    boundFetchData = fetchData.bind({
      service: this.files,
      redis: this.files.redis,
    });

    dataKey = `${FILES_DATA}:${this.response.uploadId}`;
  });

  after('stop service', stopService.bind(this));

  it('throws if no data exists', async () => {
    const result = boundFetchData('fookey');
    await assert.rejects(result, { statusCode: 404 });
  });


  it('returns data with no omit or pick', async () => {
    const result = await boundFetchData(dataKey);
    assert.deepEqual(result.uploadId, this.response.uploadId);
  });

  it('returns data with omit and no pick', async () => {
    const result = await boundFetchData(dataKey, {
      omit: ['owner'],
    });
    assert.equal(Object.getOwnPropertyNames(result).includes('owner'), false);
  });

  it('returns data with no omit and with pick', async () => {
    const result = await boundFetchData(dataKey, {
      pick: ['uploadId', 'owner'],
    });

    const shouldRespond = {
      uploadId: this.response.uploadId,
      owner: this.response.owner,
    };

    assert.deepEqual(result, shouldRespond);
  });

  it('should ignore field passed in omit event if it exists in pick', async () => {
    const result = await boundFetchData(dataKey, {
      omit: ['owner'],
      pick: ['uploadId', 'owner'],
    });

    const shouldRespond = {
      uploadId: this.response.uploadId,
    };

    assert.deepEqual(result, shouldRespond);
  });
});
