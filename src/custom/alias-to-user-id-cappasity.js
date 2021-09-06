// Extracts username from an alias
module.exports = function extractMetadata(alias) {
  const { amqp, config } = this;
  const route = config.users.getInternalData;

  if (!alias) {
    return null;
  }

  // aliases can't change unless they are deleted, so just cache them internally
  return amqp
    .publishAndWait(route, { username: alias, fields: ['id'] }, { timeout: 15000, cache: 60000 * 30 })
    .get('id');
};