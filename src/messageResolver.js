const Promise = require('bluebird');

/**
 * Message resolver
 * This is basically a policy on how to handle results of AMQP actions
 */
module.exports = function resolveMessage(err, data, actionName, actions) {
  if (!err) {
    actions.ack();
    return data;
  }

  const { name } = err;
  if (actionName !== 'process' || name === 'ValidationError' || name === 'HttpStatusError') {
    actions.reject();
    return Promise.reject(err);
  }

  actions.retry();
  return Promise.reject(err);
};
