const { ActionTransport } = require('@microfleet/core');

const fetchData = require('../../utils/fetch-data');
const hasAccess = require('../../utils/has-access');
const handlePipeline = require('../../utils/pipeline-error');
const {
  FILES_DATA_INDEX_KEY,
  FILES_EMBEDDED_INDEX_KEY,
} = require('../../constant');

async function addFileEmbed({ params }) {
  const { uploadId, username, embeddedRef } = params;

  const fileData = await fetchData.call(this, FILES_DATA_INDEX_KEY(uploadId));
  const pipeline = this.redis.pipeline();

  // it throws error
  hasAccess(username)(fileData);

  pipeline.sadd(FILES_EMBEDDED_INDEX_KEY(uploadId), embeddedRef);

  return pipeline
    .exec()
    .then(handlePipeline)
    .return(true);
}

addFileEmbed.transports = [ActionTransport.amqp];
module.exports = addFileEmbed;
