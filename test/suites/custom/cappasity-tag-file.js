const assert = require('assert');

const {
  startService,
  stopService,
  modelData,
  initAndUpload,
  processUpload,
} = require('../../helpers/utils.js');

describe('hook.cappasity-tag-file', function suite() {
  before('start service', async () => startService.call(this));
  before('pre-upload file', async () => initAndUpload(modelData, false).call(this.files));
  after('stop service', async () => stopService.call(this));

  it('should be able to tag files using google vision', async () => {

  });
});
