const hasAccess = require('../utils/has-access.js');

module.exports = function extractMetadata(username, data) {
  const { amqp, config } = this;
  const { users: { audience, getMetadata } } = config;

  return amqp.publishAndWait(getMetadata, { username, audience })
    .get(audience)
    .then(({ roles = [] }) => {
      if (roles.indexOf('admin') >= 0) {
        return data;
      }

      return hasAccess(username)(data);
    });
};
