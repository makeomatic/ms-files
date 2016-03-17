const assert = require('assert');

const {
  startService,
  stopService,
  inspectPromise,
  bindSend,
  owner,
  initAndUpload,
} = require('../helpers/utils.js');

const route = 'files.update';

describe('update suite', function suite() {

  before('start service', startService);
  before('pre-upload file', initAndUpload(modelData));
  before('helpers', bindSend(route));
  after('stop service', stopService);

  it('initiates update and returns correct response format', function test() {
    const message = {
      updateId: this.response.uploadId,
      username: owner,
      meta: {
        name: 'name',
        description: 'description',
        tags: 'tags',
        website: 'http://website.com'
      }
    }

    return this
      .send(message, 45000)
      .reflect()
      .then(inspectPromise())
      .then(rsp => {
        assert.ok(rsp.updateId);
        assert.ok(rsp.files);
        console.log('FILES:', rsp.files);
      });
  });
});
