const isDigitOnly = /[0-9]*/;
const UINT_MIN_LENGTH = 21;

// Extracts username from an alias
module.exports = async function extractMetadata(alias) {
  const { amqp, config } = this;
  const route = config.users.getInternalData;

  if (!alias) {
    return null;
  }

  // probably it's a tokenid
  if (UINT_MIN_LENGTH <= alias.length && isDigitOnly.test(alias)) {
    return alias;
  }

  // aliases can't change unless they are deleted, so just cache them internally
  const { id } = await amqp.publishAndWait(route, { username: alias, fields: ['id'] }, { timeout: 15000, cache: 60000 * 30 });

  return id;
};
