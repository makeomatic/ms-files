const assert = require('assert');

const {
  startService,
  stopService,
  modelData,
  owner,
  initUpload,
  // inspectPromise,
} = require('../../helpers/utils');

describe('embeds.add action', function suite() {
  before('start service', startService);
  before('prepare upload', initUpload(modelData));
  after('stop service', stopService);

  const route = 'files.embeds.add';

  it('400 on if embeddedRef is not hostname of url', async function test() {
    const res = this.send(route, {
      uploadId: this.response.uploadId,
      username: owner,
      embeddedRef: 'wrong.url/path',
    });

    await assert.rejects(res, {
      statusCode: 400,
      // eslint-disable-next-line no-useless-escape
      message: 'embeds.add validation failed: data.embeddedRef should match format \"hostname\"',
    });
  });

  it('should be able to add embeddedRef to file namespace', async function test() {
    const embeddedRef = 'test.com';

    const actualFilenames = await this.files.redis.sismember(`files-index:${owner}:embedded`, this.response.uploadId);
    const actualEmbeddedRefs = await this.files.redis.hexists(`files-data:${this.response.uploadId}:embedded`, embeddedRef);

    assert.strictEqual(actualFilenames, 0);
    assert.strictEqual(actualEmbeddedRefs, 0);

    const res = await this.send(route, {
      uploadId: this.response.uploadId,
      username: owner,
      embeddedRef,
    });

    const newFilenames = await this.files.redis.sismember(`files-index:${owner}:embedded`, this.response.uploadId);
    const newEmbeddedRefs = await this.files.redis.hexists(`files-data:${this.response.uploadId}:embedded`, embeddedRef);

    assert.equal(res, true);
    assert.strictEqual(newFilenames, 1);
    assert.strictEqual(newEmbeddedRefs, 1);
  });
});
