const { strict: assert } = require('assert');
const {
  bindSend,
  initAndUpload,
  modelData,
  owner,
  processUpload,
  startService,
  stopService,
} = require('../helpers/utils');

describe('header suite', function suite() {
  before('start service', startService);
  before('pre-upload file', initAndUpload(modelData));
  before('process', function pretest() {
    return processUpload.call(this, this.response);
  });
  before('set alias', function setAlias() {
    const msg = {
      uploadId: this.response.uploadId,
      username: owner,
      meta: { alias: 'skubidoo' },
    };

    return this.amqp.publishAndWait('files.update', msg, { timeout: 15000 });
  });
  before('helpers', bindSend('files.head'));

  after('stop service', stopService);

  it('should be able to return files ids', function test() {
    return this
      .send({ aliases: ['skubidoo', 'yesmomihadeaten'], username: owner })
      .then((response) => {
        assert.deepEqual(response, [this.response.uploadId, null]);
      });
  });

  it('should be able to return array of nulls if user does not exists', function test() {
    return assert.rejects(this.send({ aliases: ['skubidoo', 'yesmomihadeaten'], username: 'iamnotexist' }), {
      statusCode: 404,
    });
  });
});
