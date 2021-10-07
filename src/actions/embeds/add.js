const { ActionTransport } = require('@microfleet/core');

const { FILES_EMBEDDED_INDEX_KEY } = require('../../constant');

async function addFileEmbed({ params }) {
  const { uploadId, embeddedRef } = params;

  await this.redis.hset(FILES_EMBEDDED_INDEX_KEY(uploadId), embeddedRef, true);

  return true;
}

addFileEmbed.transports = [ActionTransport.amqp];
module.exports = addFileEmbed;
