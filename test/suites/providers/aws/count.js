const assert = require('assert');

// helpers
const {
  startService,
  stopService,
  owner,
  bindSend,
} = require('../../../helpers/utils.js');
const { insertData } = require('../../../helpers/insert-data');
const { STATUS_PROCESSED } = require('../../../../src/constant');

const route = 'files.count';

describe('count suite', function suite() {
  // setup functions
  before('start service', startService);

  before('helpers', bindSend(route));

  before('insert data', function insertFiles() {
    return insertData.call(this, { times: 20, owners: [owner], statuses: [STATUS_PROCESSED] });
  });

  // tear-down
  after('stop service', stopService);

  it('returns file counts for the user', async function test() {
    const result = await this.send({ username: owner });

    assert.strictEqual(result.total, 20);
    assert.ok(typeof result.public === 'number');
  });
});
