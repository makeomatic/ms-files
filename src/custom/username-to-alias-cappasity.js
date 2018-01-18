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
    }, {
      timeout: 5000,
      cache: 60000 * 5, /* 5 minutes */
    })
    .then(it => it[audience].alias);
};
