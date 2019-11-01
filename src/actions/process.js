const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const {
  STATUS_PENDING,
  STATUS_PROCESSING,
  STATUS_UPLOADED,
  STATUS_FAILED,
  FILES_DATA,
  FILES_PROCESS_ERROR_COUNT_FIELD,
  FILES_PROCESS_ERROR_FIELD,
  FILES_POST_ACTION,
  FILES_OWNER_FIELD,
} = require('../constant');

const postProcess = require('../utils/process');
const fetchData = require('../utils/fetch-data');
const hasAccess = require('../utils/has-access');

/**
 * Post process file
 * @param  {Object}  request
 * @param  {Object}  request.params
 * @param  {Object}  request.params.filename
 * @param  {Object}  request.params.username
 * @param  {Boolean} request.params.awaitPostActions
 * @return {Promise}
 */
async function postProcessFile({ params }) {
  const { uploadId, username, awaitPostActions } = params;
  const { maxTries } = this.config;
  const key = `${FILES_DATA}:${uploadId}`;

  const fileData = await Promise
    .bind(this, key)
    .then(fetchData)
    .then(hasAccess(username));

  const { status } = fileData;
  const exportSettings = params.export || fileData.export;

  if (exportSettings) {
    if (fileData[exportSettings.format]) {
      throw new HttpStatusError(418, `format "${exportSettings.format}" is already present`);
    }

    if (status === STATUS_PENDING || status === STATUS_PROCESSING) {
      throw new HttpStatusError(409, 'file is being processed or upload has not been finished yet');
    }

    fileData.export = exportSettings;
  } else if (status !== STATUS_UPLOADED && status !== STATUS_FAILED) {
    throw new HttpStatusError(412, 'file is being processed or upload has not been finished yet');
  }

  if (status === STATUS_FAILED && fileData[FILES_PROCESS_ERROR_COUNT_FIELD] && fileData[FILES_PROCESS_ERROR_COUNT_FIELD] >= maxTries) {
    this.log.error({ params }, 'failed to process file', fileData[FILES_PROCESS_ERROR_FIELD]);
    throw new HttpStatusError(422, 'could not process file');
  }

  const data = await Promise
    .bind(this, [key, fileData])
    .spread(postProcess);

  const { prefix } = this.config.router.routes;
  const postActionKey = `${FILES_POST_ACTION}:${uploadId}`;

  // check if we have post actions and perform them
  const postAction = await this.redis.get(postActionKey);

  // no post-action - we are done
  if (!postAction) {
    return data;
  }

  // parse and fetch update
  const actions = [];
  const { update } = JSON.parse(postAction);

  // if we have update
  if (update) {
    const message = {
      uploadId,
      meta: update,
      username: data[FILES_OWNER_FIELD],
    };

    // publish, but don't wait for result
    actions.push(this.amqp.publishAndWait(`${prefix}.update`, message).catch((e) => {
      this.log.warn({ params, tag: 'post-update', err: e }, 'failed to perform post-update');
    }));
  }

  // either wait for action to complete or not
  const response = await awaitPostActions
    ? Promise.all(actions)
    : null;

  await this.redis.del(postActionKey);
  return response;
}

postProcessFile.transports = [ActionTransport.amqp];
module.exports = postProcessFile;
