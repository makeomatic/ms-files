// Extracts username from an alias
module.exports = function extractMetadata(alias) {
  const { amqp, config } = this;
  const route = config.users.getInternalData;

  return amqp
    .publishAndWait(route, { username: alias, fields: ['username'] }, { timeout: 1500 })
    .get('username');
};
