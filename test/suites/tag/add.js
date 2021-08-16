const assert = require('assert');

const {
  startService,
  stopService,
  modelData,
  owner,
  initUpload,
  inspectPromise,
} = require('../../helpers/utils');

describe('tag.add action', function suite() {
  before('start service', startService);
  before('prepare upload', initUpload(modelData));
  after('stop service', stopService);

  it('should be able to return error if duplicate tags in request', function test() {
    return this.amqp
      .publishAndWait('files.tag.add', {
        uploadId: this.response.uploadId,
        username: owner,
        tags: ['PERCHIK', 'FAT', 'FAT'] })
      .reflect()
      .then(inspectPromise(false))
      .then((error) => {
        assert.equal(error.message, 'tag.add validation failed: data/tags should '
          + 'NOT have duplicate items (items ## 2 and 1 are identical)');
      });
  });

  it('should be able to update tags', async function test() {
    let actualTags = await this.files.redis.hget(`files-data:${this.response.uploadId}`, 'tags');

    assert.deepEqual(actualTags, '["ok","done"]');

    let response = await this.amqp.publishAndWait('files.tag.add', {
      uploadId: this.response.uploadId,
      username: owner,
      tags: ['PERCHIK', 'fat'] });

    actualTags = await this.files.redis.hget(`files-data:${this.response.uploadId}`, 'tags');

    assert.equal(response, true);
    assert.deepEqual(actualTags, '["ok","done","perchik","fat"]');

    // try duplicate tags
    response = await this.amqp.publishAndWait('files.tag.add', {
      uploadId: this.response.uploadId,
      username: owner,
      tags: ['CAT', 'FAT', 'fat'] });

    actualTags = await this.files.redis.hget(`files-data:${this.response.uploadId}`, 'tags');

    assert.equal(response, true);
    assert.deepEqual(actualTags, '["ok","done","perchik","fat","cat"]');
  });
});
