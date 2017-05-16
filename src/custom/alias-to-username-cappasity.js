// Extracts username from an alias
module.exports = function extractMetadata(alias) {
  const { amqp, config } = this;
  const route = config.users.getInternalData;

  if (!alias) {
    return null;
  }

  return amqp
    .publishAndWait(route, { username: alias, fields: ['id'] }, { timeout: 3500 })
    .get('id');
};
