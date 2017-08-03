// Extracts username from an alias
module.exports = function extractMetadata(userId) {
  const { amqp, config } = this;
  const { users: { getMetadata, audience } } = config;

  if (!userId) {
    return null;
  }

  return amqp
    .publishAndWait(getMetadata, {
      username: userId,
      audience,
      fields: {
        [audience]: ['alias'],
      },
    })
    .then(it => it[audience].alias);
};
