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
    .disposer(lock => (
      lock.release().catch(err => log.error('failed to release lock for', args, err))
    ));
}

module.exports = acquireLock;
