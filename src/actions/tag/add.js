const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');

const hasAccess = require('../../utils/has-access');
const handlePipeline = require('../../utils/pipeline-error');
const fetchData = require('../../utils/fetch-data');
const getLock = require('../../utils/acquire-lock');
const stringify = require('../../utils/stringify');
const {
  LOCK_UPDATE_KEY,
  FILES_DATA_INDEX_KEY,
  FILES_TAGS_INDEX_KEY,
  FILES_TAGS_FIELD,
  FIELDS_TO_STRINGIFY,
} = require('../../constant');

const { call } = Function.prototype;
const { toLowerCase } = String.prototype;
const arrayUniq = (element, index, array) => array.indexOf(element) === index;

async function addTag(params) {
  const { uploadId, username } = params;
  const tags = params.tags
    .map(call, toLowerCase)
    .filter(arrayUniq);
  const fileData = await fetchData.call(this, FILES_DATA_INDEX_KEY(uploadId));
  const pipeline = this.redis.pipeline();

  // it throws error
  hasAccess(username)(fileData);

  // @todo migrate all tags in files data to lowercase and then remove this .map
  const actualTags = (fileData[FILES_TAGS_FIELD] || []).map(call, toLowerCase);
  const tagsDiff = tags.filter((tag) => !actualTags.includes(tag));

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
