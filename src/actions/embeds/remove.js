const { ActionTransport } = require('@microfleet/core');

const {
  FILES_DATA,
  FILES_EMBEDDED_POSTFIX,
  FILES_USER_EMBEDDED_INDEX_KEY,
} = require('../../constant');

async function removeEmbeds({ params }) {
  const { username } = params;

  await this.redis.removeEmbeds(
    3,
    FILES_USER_EMBEDDED_INDEX_KEY(username),
    FILES_DATA,
    FILES_EMBEDDED_POSTFIX
  );

  return true;
}

removeEmbeds.transports = [ActionTransport.amqp];
module.exports = removeEmbeds;
