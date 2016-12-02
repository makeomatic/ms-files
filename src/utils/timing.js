const debug = require('debug')('ms-files:timing');

function addStep(step, final) {
  const { name, timers, timer } = this;

  const diff = process.hrtime(timer);
  const time = (diff[0] * 1e3) + (diff[1] / 1000);

  debug('performed %s:%s in %d', name, step, time);
  timers[`${name}:${step}`] = time;

  if (final) {
    debug('performed %s in %j', name, timers);
    this.timers = null;
    this.timer = null;
    this.name = null;
  } else {
    this.timer = process.hrtime();
  }
}

module.exports = (name) => {
  // generates context and bound function
  const ctx = {
    name,
    timers: {},
    timer: process.hrtime(),
  };

  // while we are on node < 7 we use closure
  const caller = (step, final) => () => addStep.call(ctx, step, final);
  caller.timers = ctx.timers;
  return caller;
};
