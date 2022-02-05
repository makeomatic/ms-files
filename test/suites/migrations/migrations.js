const Bluebird = require('bluebird');
const sinon = require('sinon');
const { strict: assert } = require('assert');
const { resolve } = require('path');

// helpers
const {
  startService,
  stopService,
  modelData,
  initAndUpload,
} = require('../../helpers/utils');

const { getRedisMasterNode } = require('../../../src/utils/get-redis-master-node');
const { FILES_INDEX_UAT } = require('../../../src/constant');

const ctx = Object.create(null);

// data
describe('migrations testing suite', function suite() {
  // setup functions
  before('start service', async () => {
    await startService.call(ctx);

    const amqpStub = sinon
      .stub(ctx.files.amqp, 'publishAndWait')
      .usingPromise(Bluebird)
      .callThrough();

    amqpStub
      .withArgs(ctx.files.config.users.getInternalData, sinon.match.any)
      .resolves({ id: '000000' });
  });
  after('stop service', stopService.bind(ctx));

  it('pre-upload files', async () => {
    await Promise.all(
      Array
        .from({ length: 20 })
        .map(initAndUpload(modelData, false).bind(ctx))
    );
  });

  it('erase migration keys', async () => {
    const redis = getRedisMasterNode(ctx.files.redis, ctx.files);
    const { keyPrefix } = ctx.files.config.redis.options;
    const keys = await redis.keys(`${keyPrefix}${FILES_INDEX_UAT}*`);
    assert(keys.length > 0, `no keys found - ${keyPrefix} ~ ${FILES_INDEX_UAT}`);
    ctx.files.log.warn({ keys }, 'retrieved keys');
    const eraseKeys = redis.options.keyPrefix
      ? keys.map((key) => key.substring(redis.options.keyPrefix.length))
      : keys;
    ctx.files.log.warn('erasing %j', eraseKeys);
    const removed = await redis.del(eraseKeys);
    ctx.files.log.warn('erased %d keys', removed);
    assert.equal((await redis.keys(`${keyPrefix}${FILES_INDEX_UAT}*`)).length, 0);
  });

  it('runs migration afterwards and restores keys', async () => {
    await ctx.files.migrate('redis', resolve(__dirname, '../../../src/migrations'));
    const redis = getRedisMasterNode(ctx.files.redis, ctx.files);
    const { keyPrefix } = ctx.files.config.redis.options;
    const keys = await redis.keys(`${keyPrefix}${FILES_INDEX_UAT}*`);
    assert(keys.length > 0, 'no keys found');
  });
});
