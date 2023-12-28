const isDigitOnly = /[0-9]*/;

// Extracts username from an alias
module.exports = async function extractMetadata(alias) {
  const { amqp, config } = this;
  const route = config.users.getInternalData;

  if (!alias) {
    return null;
  }

  // probably it's a tokenid
  if (alias.length >= 39 && isDigitOnly.test(alias)) {
    return alias;
  }

  // aliases can't change unless they are deleted, so just cache them internally
  const { id } = await amqp.publishAndWait(route, { username: alias, fields: ['id'] }, { timeout: 15000, cache: 60000 * 30 });

  return id;
};
