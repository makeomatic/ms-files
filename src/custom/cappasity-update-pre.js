const Promise = require('bluebird');

module.exports = function extractMetadata(username) {
  const { amqp, config } = this;
  const { users: { audience, getMetadata } } = config;

  return amqp.publishAndWait(getMetadata, { username, audience })
    .get(audience)
    .then(({ roles = [] }) => {
      if (roles.indexOf('admin') >= 0) {
        return true;
      }

      return false;
    });
};
