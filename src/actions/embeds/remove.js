const { ActionTransport } = require('@microfleet/core');

const {
  FILES_DATA,
  FILES_EMBEDDED_POSTFIX,
  FILES_USER_EMBEDDED_INDEX_KEY,
} = require('../../constant');

async function removeEmbeds({ params }) {
  const { username } = params;

  const removeEmbdesKeys = [FILES_USER_EMBEDDED_INDEX_KEY(username), FILES_DATA];
  const removeEmbdesArgs = [FILES_EMBEDDED_POSTFIX];

  await this.redis.removeEmbeds(2, removeEmbdesKeys, removeEmbdesArgs);

  return true;
}

removeEmbeds.transports = [ActionTransport.amqp];
module.exports = removeEmbeds;
