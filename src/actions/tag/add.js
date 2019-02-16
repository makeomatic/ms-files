const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');

const hasAccess = require('../../utils/hasAccess');
const handlePipeline = require('../../utils/pipelineError');
const fetchData = require('../../utils/fetchData');
const getLock = require('../../utils/acquireLock');
const stringify = require('../../utils/stringify');
const {
  LOCK_UPDATE_KEY,
  FILES_DATA_INDEX_KEY,
  FILES_TAGS_INDEX_KEY,
  FILES_TAGS_FIELD,
  FIELDS_TO_STRINGIFY,
} = require('../../constant.js');

async function addTag(params) {
  const { uploadId, username, tags } = params;
  const fileData = await fetchData.call(this, FILES_DATA_INDEX_KEY(uploadId));
  const pipeline = this.redis.pipeline();

  // it throws error
  hasAccess(username)(fileData);

  const actualTags = fileData[FILES_TAGS_FIELD] || [];
  const tagsDiff = tags.filter(tag => !actualTags.includes(tag));

  for (const tag of tagsDiff) {
    pipeline.sadd(FILES_TAGS_INDEX_KEY(tag), uploadId);
  }

  const updateData = { [FILES_TAGS_FIELD]: [...actualTags, ...tagsDiff] };

  // @todo refactor stringify method
  if (FIELDS_TO_STRINGIFY.includes(FILES_TAGS_FIELD)) {
    stringify(updateData, FILES_TAGS_FIELD);
  }

  pipeline.hmset(FILES_DATA_INDEX_KEY(uploadId), updateData);

  return pipeline
    .exec()
    .then(handlePipeline)
    .return(true);
}

async function addTagAction({ params }) {
  const { uploadId } = params;

  return Promise.using(
    getLock(this, LOCK_UPDATE_KEY(uploadId)),
    () => addTag.call(this, params)
  );
}

addTagAction.transports = [ActionTransport.amqp];
module.exports = addTagAction;
