const { ActionTransport } = require('@microfleet/core');

const fetchData = require('../../utils/fetch-data');
const hasAccess = require('../../utils/has-access');
const handlePipeline = require('../../utils/pipeline-error');
const {
  FILES_DATA_INDEX_KEY,
  FILES_EMBEDDED_INDEX_KEY,
} = require('../../constant');

async function removeFileEmbeds({ params }) {
  const { uploadId, username } = params;

  const fileData = await fetchData.call(this, FILES_DATA_INDEX_KEY(uploadId));
  const pipeline = this.redis.pipeline();

  // it throws error
  hasAccess(username)(fileData);

  pipeline.del(FILES_EMBEDDED_INDEX_KEY(uploadId));

  return pipeline
    .exec()
    .then(handlePipeline)
    .return(true);
}

removeFileEmbeds.transports = [ActionTransport.amqp];
module.exports = removeFileEmbeds;
