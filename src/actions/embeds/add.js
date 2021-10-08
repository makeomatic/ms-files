const { ActionTransport } = require('@microfleet/core');

const handlePipeline = require('../../utils/pipeline-error');
const {
  FILES_EMBEDDED_INDEX_KEY,
  FILES_USER_EMBEDDED_INDEX_KEY,
} = require('../../constant');

async function addEmbed({ params }) {
  const { uploadId, username, embeddedRef } = params;

  const pipeline = this.redis.pipeline();

  pipeline.sadd(FILES_USER_EMBEDDED_INDEX_KEY(username), uploadId);
  pipeline.hset(FILES_EMBEDDED_INDEX_KEY(uploadId), embeddedRef, true);

  return pipeline
    .exec()
    .then(handlePipeline)
    .return(true);
}

addEmbed.transports = [ActionTransport.amqp];
module.exports = addEmbed;
