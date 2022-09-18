const hasAccess = require('../utils/has-access');

module.exports = async function extractMetadata(username, data) {
  const { amqp, config } = this;
  const { users: { audience, getMetadata } } = config;

  const userData = await amqp.publishAndWait(getMetadata, { username, audience });
  const { roles = [] } = userData[audience];

  if (roles.indexOf('admin') >= 0) {
    return data;
  }

  return hasAccess(username)(data);
};
