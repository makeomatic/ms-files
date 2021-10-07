const { ActionTransport } = require('@microfleet/core');

const { FILES_EMBEDDED_INDEX_KEY } = require('../../constant');

async function removeFileEmbeds({ params }) {
  const { uploadId } = params;

  await this.redis.del(FILES_EMBEDDED_INDEX_KEY(uploadId));

  return true;
}

removeFileEmbeds.transports = [ActionTransport.amqp];
module.exports = removeFileEmbeds;
