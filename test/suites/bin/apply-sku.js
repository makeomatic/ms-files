/* eslint-disable no-console */

const assert = require('assert');
const path = require('path');

// helpers
const {
  startService,
  stopService,
  owner,
  modelData,
  bindSend,
  initAndUpload,
  processUpload,
} = require('../../helpers/utils');

describe('binary: apply-sku', function suite() {
  const binaryPath = path.resolve(__dirname, '../../../bin/apply-sku.js');
  const exec = require('../../helpers/exec')(binaryPath, ['--user', owner]);

  before('start service', startService);
  before('pre-upload file', initAndUpload(modelData));
  before('process file upload', processUpload);
  before('helpers', bindSend('files.info'));
  after('stop service', stopService);

  it('dry run: lists files without changing them', function test() {
    return exec().then((lines) => {
      // ensure there are 4 lines
      assert.equal(lines.length, 4);
      assert.equal(lines[2], 'pages found: 1');
      assert.ok(/^\[dry-run\]/.test(lines[3]), lines[3]);
      return null;
    });
  });

  it('confirm: sets alias', function test() {
    return exec(['--confirm']).then((lines) => {
      // ensure there are 4 lines
      assert.equal(lines.length, 4);
      assert.equal(lines[2], 'pages found: 1');
      assert.ok(/^set alias for/.test(lines[3]), lines[3]);
    });
  });
});
