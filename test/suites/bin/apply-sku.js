/* eslint-disable no-console */

const assert = require('assert');
const path = require('path');
const spawn = require('child_process').execFile;

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

const transport = require('../../helpers/config').amqp.transport.connection;

describe('binary: apply-sku', function suite() {
  const binaryPath = path.resolve(__dirname, '../../../bin/apply-sku.js');

  before('start service', startService);
  before('pre-upload file', initAndUpload(modelData));
  before('process file upload', processUpload);
  before('helpers', bindSend('files.info'));
  after('stop service', stopService);

  function exec(next, args = []) {
    spawn(binaryPath, ['--user', owner, ...args], {
      timeout: 20000,
      env: Object.assign({
        NCONF_NAMESPACE: 'MS_FILES',
        MS_FILES__AMQP__TRANSPORT__CONNECTION__HOST: transport.host,
        MS_FILES__AMQP__TRANSPORT__CONNECTION__PORT: transport.port,
      }, process.env),
      cwd: process.cwd(),
    }, (err, stdout, stderr) => {
      if (err) {
        return next(err);
      }

      assert.equal(stderr, '');
      const lines = stdout.split('\n');
      return next(null, lines.slice(0, -1));
    });
  }

  it('dry run: lists files without changing them', function test(next) {
    const proc = (err, lines) => {
      if (err) return next(err);

      // ensure there are 4 lines
      assert.equal(lines.length, 4);
      assert.equal(lines[2], 'pages found: 1');
      assert.ok(/^\[dry-run\]/.test(lines[3]), lines[3]);

      return next();
    };

    exec(proc);
  });

  it('confirm: sets alias', function test(next) {
    const proc = (err, lines) => {
      if (err) return next(err);

      // ensure there are 4 lines
      assert.equal(lines.length, 4);
      assert.equal(lines[2], 'pages found: 1');
      assert.ok(/^set alias for/.test(lines[3]), lines[3]);

      return next();
    };

    exec(proc, ['--confirm']);
  });
});
