// Extracts username from an alias
module.exports = function extractMetadata(username) {
  const { amqp, config } = this;
  const { users: { getMetadata, audience } } = config;

  if (!username) {
    return null;
  }

  return amqp
    .publishAndWait(getMetadata, {
      username,
      audience,
      fields: {
        [audience]: ['alias'],
      },
    })
    .then(it => it[audience].alias);
};
