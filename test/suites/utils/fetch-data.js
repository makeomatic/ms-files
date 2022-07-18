const assert = require('assert');

const {
  startService,
  stopService,
  modelData,
  finishUpload,
  processUpload,
  initUpload,
} = require('../../helpers/utils');

const { FILES_DATA } = require('../../../src/constant');
const fetchData = require('../../../src/utils/fetch-data');

describe('util fetch-data suite', () => {
  let boundFetchData;
  let boundFetchDataBatch;

  let dataKey;
  before('start service', startService.bind(this));

  before('init upload', async () => {
    const myModelData = {
      ...modelData,
      message: {
        ...modelData.message,
        meta: {
          ...modelData.message.meta,
          tags: ['some', 'tags'],
          ar3dviewProps: { prop: 43 },
          creationInfo: {
            os: 'linux',
            props: {
              some: 1,
            },
          },
          dimensions: [3],
          capabilities: ['cap1'],
        },
      },
    };

    await initUpload(myModelData).call(this);
    await finishUpload.call(this, this.response);
    await processUpload.call(this, this.response);

    boundFetchData = fetchData.bind({
      service: this.files,
      redis: this.files.redis,
    });

    boundFetchDataBatch = fetchData.batch.bind({
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

  it('decodes files, tags, dimensions, capabilities, ar3dviewProps, creationInfo', async () => {
    const result = await boundFetchData(dataKey);

    assert.equal(result.files.length, this.response.files.length);
    assert.deepEqual(result.tags, this.response.tags);
    assert.deepEqual(result.dimensions, this.response.dimensions);
    assert.deepEqual(result.capabilities, this.response.capabilities);
    assert.deepEqual(result.ar3dviewProps, this.response.ar3dviewProps);
    assert.deepEqual(result.creationInfo, this.response.creationInfo);
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

  it('should ignore field passed in omit even if it exists in pick', async () => {
    const result = await boundFetchData(dataKey, {
      omit: ['owner'],
      pick: ['uploadId', 'owner'],
    });

    const shouldRespond = {
      uploadId: this.response.uploadId,
    };

    assert.deepEqual(result, shouldRespond);
  });

  it('boundFetchData returns data without omit or pick', async () => {
    const [result] = await boundFetchDataBatch([dataKey]);
    const fileInfo = result.value();
    assert.equal(fileInfo.uploadId, this.response.uploadId);
  });

  it('boundFetchData returns data without omit or pick as null or undefined', async () => {
    const [result] = await boundFetchDataBatch([dataKey], { pick: null, omit: null });
    const fileInfo = result.value();
    assert.equal(fileInfo.uploadId, this.response.uploadId);

    const [resultSecond] = await boundFetchDataBatch([dataKey], { pick: undefined, omit: undefined });
    const fileInfoSecond = resultSecond.value();
    assert.equal(fileInfoSecond.uploadId, this.response.uploadId);
  });
});
