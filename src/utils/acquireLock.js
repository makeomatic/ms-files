const { MultiLockError } = require('dlock');
const { HttpStatusError } = require('common-errors');

function acquireLock(ctx, ...keys) {
  const dlock = ctx.dlock;
  const log = ctx.log;

  let acquire;
  let args;

  if (keys.length === 1) {
    acquire = dlock.once;
    args = keys[0];
  } else {
    acquire = dlock.multi;
    args = keys;
  }

  return acquire
    .call(dlock, args)
    .catch(MultiLockError, () => {
      log.warn('failed to lock: %j', keys);
      throw new HttpStatusError(409, 'concurrent access to a locked resource, try again in a few seconds');
    })
    .disposer(lock => (
      lock.release().catch(err => log.error('failed to release lock for', args, err))
    ));
}

module.exports = acquireLock;
