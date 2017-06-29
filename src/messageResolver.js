const Promise = require('bluebird');
const debug = require('debug')('ms-files:messageResolver');

// make sure we dont reject .process right away
const isProcess = /\.process$/;

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
  if (isProcess.test(actionName) !== true || name === 'ValidationError' || name === 'HttpStatusError') {
    debug('reject %s after ', actionName, err);
    // NOTE: we ack the message so that it is not delivered into the dead-letter-exchange
    actions.ack();
    return Promise.reject(err);
  }

  debug('retry %s after', actionName, err);
  actions.retry();
  return Promise.reject(err);
};
