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
  const binaryPath = path.resolve(__dirname, '../../../bin/apply-sku');
  const exec = require('../../helpers/exec')(binaryPath, ['--user', owner]);

  before('start service', startService);
  before('pre-upload file', initAndUpload(modelData));
  before('process file upload', processUpload);
  before('pre-upload file #2', initAndUpload(modelData));
  before('process file upload #2', processUpload);
  before('helpers', bindSend('files.info'));
  after('stop service', stopService);

  it('dry run: lists files without changing them', function test() {
    return exec().then((lines) => {
      console.log(lines);
      assert.equal(lines.length, 5);
      assert.equal(lines[2], 'pages found: 1');
      assert.ok(/^\[dry-run\]/.test(lines[3]), lines[3]);
      return null;
    });
  });

  it('confirm: sets alias', function test() {
    return exec(['--confirm']).then((lines) => {
      console.log(lines);
      assert.equal(lines.length, 5);
      assert.equal(lines[2], 'pages found: 1');
      assert.ok(/^set alias for/.test(lines[3]), lines[3]);
      assert.ok(/^\[warn\] failed to set alias/.test(lines[4]), lines[4]);
      return null;
    });
  });

  it('confirm: sets alias & overwrite on a newer one', function test() {
    return exec(['--confirm', '--overwrite']).then((lines) => {
      console.log(lines);
      assert.equal(lines.length, 5);
      assert.equal(lines[2], 'pages found: 1');
      assert.ok(/^\[warn\] checking for overwrite/.test(lines[3]), lines[3]);
      assert.ok(/^set alias for/.test(lines[4]), lines[4]);
      return null;
    });
  });

  it('confirm: sets alias & fail to overwrite on an older one', function test() {
    return exec(['--confirm', '--overwrite']).then((lines) => {
      console.log(lines);
      assert.equal(lines.length, 6);
      assert.equal(lines[2], 'pages found: 1');
      assert.ok(/^\[warn\] checking for overwrite/.test(lines[3]), lines[3]);
      assert.ok(/^\[warn\] overwrite failed:/.test(lines[4]), lines[4]);
      assert.ok(/^\[warn\] failed to set alias/.test(lines[5]), lines[5]);
      return null;
    });
  });
});
