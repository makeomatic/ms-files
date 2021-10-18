const assert = require('assert');

const {
  startService,
  stopService,
  modelData,
  owner,
  initUpload,
  addEmbeddedRef,
} = require('../../helpers/utils');

describe('embeds.remove action', function suite() {
  before('start service', startService);
  before('prepare upload', initUpload(modelData));
  after('stop service', stopService);

  before('add embedded ref', async function pretest() {
    return addEmbeddedRef.call(this, {
      uploadId: this.response.uploadId,
      username: owner,
      embeddedRef: 'test.embedded.com',
      embeddedLimitType: '1',
    });
  });

  const route = 'files.embeds.remove';

  it('should be able to remove embeddedRef from file and user namespace', async function test() {
    const actualIsExistsFilenames = await this.files.redis.exists(`files-index:${owner}:embedded`);
    const actualIsExistsEmbeddedRefs = await this.files.redis.exists(`files-data:${this.response.uploadId}:embedded`);

    assert.deepStrictEqual(actualIsExistsFilenames, 1);
    assert.deepStrictEqual(actualIsExistsEmbeddedRefs, 1);

    const res = await this.send(route, { username: owner });

    const newIsExistsFilenames = await this.files.redis.exists(`files-index:${owner}:embedded`);
    const newIsExistsEmbeddedRefs = await this.files.redis.exists(`files-data:${this.response.uploadId}:embedded`);

    assert.equal(res, true);
    assert.strictEqual(newIsExistsFilenames, 0);
    assert.strictEqual(newIsExistsEmbeddedRefs, 0);
  });
});
