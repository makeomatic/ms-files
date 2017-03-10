/* eslint-disable no-console */

const assert = require('assert');
const path = require('path');
const spawn = require('child_process').spawn;

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
    const child = spawn('node', [binaryPath, '--user', owner, ...args], {
      shell: true,
      env: Object.assign({
        MS_FILES__AMQP__TRANSPORT__CONNECTION__HOST: transport.host,
        MS_FILES__AMQP__TRANSPORT__CONNECTION__PORT: transport.port,
      }, process.env),
      cwd: process.cwd(),
    });

    const stdoutBuffer = [];
    const stderrBuffer = [];
    let timeout;

    function done(code) {
      if (timeout) clearTimeout(timeout);

      const stdout = stdoutBuffer.join('');
      const stderr = stderrBuffer.join('');

      if (code !== 0) {
        console.log(stdout);
        return next(new Error(stderr));
      }

      assert.equal(stderr, '');
      const lines = stdout.split('\n');
      return next(null, lines.slice(0, -1));
    }

    child.stdout.on('data', data => stdoutBuffer.push(data));
    child.stderr.on('data', data => stderrBuffer.push(data));
    child.on('error', done);
    child.on('close', done);
    timeout = setTimeout(done, 10000, 128);
  }

  it('dry run: lists files without changing them', function test(next) {
    const proc = (err, stdout) => {
      if (err) return next(err);

      // ensure there are 4 lines
      assert.equal(stdout.length, 4);
      assert.equal(stdout[2], 'pages found: 1');
      assert.ok(/^\[dry-run\]/.test(stdout[3]), stdout[3]);

      return next();
    };

    exec(proc);
  });

  it('confirm: sets alias', function test(next) {
    const proc = (err, stdout) => {
      if (err) return next(err);

      // ensure there are 4 lines
      assert.equal(stdout.length, 4);
      assert.equal(stdout[2], 'pages found: 1');
      assert.ok(/^set alias for/.test(stdout[3]), stdout[3]);

      return next();
    };

    exec(proc, ['--confirm']);
  });
});
