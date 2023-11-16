const sinon = require('sinon');
const { strict: assert } = require('assert');
const { resolve } = require('path');
const Redis = require('ioredis');

// helpers
const {
  startService,
  stopService,
  modelData,
  initAndUpload,
} = require('../../helpers/utils');

const { getRedisMasterNode } = require('../../../src/utils/get-redis-master-node');
const {
  FILES_INDEX_UAT,
  FILES_INDEX,
  FILES_DATA_INDEX_KEY,
  FILES_NAME_FIELD,
  FILES_NAME_NORMALIZED_FIELD,
} = require('../../../src/constant');

const ctx = Object.create(null);

// data
describe('migrations testing suite', function suite() {
  // setup functions
  before('start service', async () => {
    await startService.call(ctx);

    const amqpStub = sinon
      .stub(ctx.files.amqp, 'publishAndWait')
      .callThrough();

    amqpStub
      .withArgs(ctx.files.config.users.getInternalData, sinon.match.any)
      .resolves({ id: '000000' });
  });
  after('stop service', () => stopService.call(ctx));

  it('pre-upload files', async () => {
    const uploads = [];
    for (let i = 0; i < 20; i += 1) {
      uploads.push(initAndUpload(modelData, false).call({
        ...ctx,
      }));
    }
    await Promise.all(uploads);
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

  it('migrates name to normalized name', async () => {
    const { redis } = ctx.files;

    const filesIndexKey = FILES_INDEX;
    const uploads = await redis.smembers(filesIndexKey);

    // cleanup indexes and reset version
    // node on cluster sometimes request sent to different nodes.
    // so index exists on one node, but absent on another
    const redisMaster = getRedisMasterNode(ctx.files.redis, ctx.files);
    const indexes = await redisMaster.sendCommand(new Redis.Command('ft._list'));

    await Promise.all(indexes.map((index) => redisMaster.sendCommand(new Redis.Command('ft.dropindex', index))));
    await redis.del('version');

    // set name to new value
    const fileDataKey = FILES_DATA_INDEX_KEY(uploads[0]);
    await redis.hset(fileDataKey, FILES_NAME_FIELD, 'New Value');

    await ctx.files.migrate('redis', resolve(__dirname, '../../../src/migrations'));

    const migratedData = await redis.hgetall(fileDataKey);
    assert.deepStrictEqual(migratedData[FILES_NAME_NORMALIZED_FIELD], 'new value');
  });
});
