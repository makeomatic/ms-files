const hasAccess = require('../utils/has-access');

const isDigitOnly = /[0-9]*/;
const UINT_MIN_LENGTH = 21;

module.exports = async function extractMetadata(username, data) {
  if (UINT_MIN_LENGTH <= username.length && isDigitOnly.test(username)) {
    return hasAccess(username)(data);
  }

  const { amqp, config } = this;
  const { users: { audience, getMetadata } } = config;

  const userData = await amqp.publishAndWait(getMetadata, { username, audience });
  const { roles = [] } = userData[audience];

  if (roles.indexOf('admin') >= 0) {
    return data;
  }

  return hasAccess(username)(data);
};
