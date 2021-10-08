const { ActionTransport } = require('@microfleet/core');

const handlePipeline = require('../../utils/pipeline-error');
const {
  FILES_EMBEDDED_INDEX_KEY,
  FILES_USER_EMBEDDED_INDEX_KEY,
} = require('../../constant');

async function removeEmbeds({ params }) {
  const { username } = params;

  const fileNames = await this.redis.smembers(FILES_USER_EMBEDDED_INDEX_KEY(username));

  const pipeline = this.redis.pipeline();

  fileNames.forEach((filename) => pipeline.del(FILES_EMBEDDED_INDEX_KEY(filename)));
  pipeline.del(FILES_USER_EMBEDDED_INDEX_KEY(username));

  return pipeline
    .exec()
    .then(handlePipeline)
    .return(true);
}

removeEmbeds.transports = [ActionTransport.amqp];
module.exports = removeEmbeds;
