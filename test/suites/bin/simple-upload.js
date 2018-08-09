/* eslint-disable no-console */

const assert = require('assert');
const path = require('path');

// helpers
const {
  startService,
  stopService,
  owner,
  bindSend,
} = require('../../helpers/utils');

describe('binary: simple-upload', function suite() {
  const binaryPath = path.resolve(__dirname, '../../../bin/simple-upload.js');
  const exec = require('../../helpers/exec')(binaryPath, ['-u', owner]);

  before('start service', startService);
  before('helpers', bindSend('files.info'));
  after('stop service', stopService);

  const opts = [
    '-f', './test/fixtures/sample-pack',
    '-p', './test/fixtures/sample-pack/preview.jpeg',
    '-n', 'pack sample',
    '--public',
    '--exclude-preview',
    '--report-finish',
  ];

  it('dry run: prepares upload message', function test() {
    return exec([...opts]).then((lines) => {
      assert.deepEqual(lines, [
        'resolved 1 file(s)',
        'Dry run, printing prepared message:',
        '',
        '',
        '{ username: \'v@makeomatic.ru\',',
        '  meta: { name: \'pack sample\' },',
        '  access: { setPublic: true },',
        '  uploadType: \'simple\',',
        '  resumable: false,',
        '  temp: false,',
        '  unlisted: false,',
        '  files:',
        '   [ { type: \'c-preview\',',
        '       contentType: \'image/jpeg\',',
        '       contentLength: 64024,',
        '       md5Hash: \'03506d1122d213baa1445f6b5655d2e4\' },',
        '     { type: \'c-pack\',',
        '       contentType: \'image/vnd.cappasity\',',
        '       contentLength: 21680,',
        '       md5Hash: \'4f91e44f50cc8647611606eff0ada50e\' } ] }',
      ]);

      return null;
    });
  });

  it('confirm: sends upload', function test() {
    return exec([...opts, '--confirm'])
      .then((lines) => {
        const uploadId = lines[3];
        assert.ok(uploadId);
        return this.send({ username: owner, filename: uploadId });
      })
      .then((response) => {
        assert.equal(response.file.status, '3');
        return null;
      });
  });
});
