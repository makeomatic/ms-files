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
} = require('../constant.js');

const postProcess = require('../utils/process');
const fetchData = require('../utils/fetchData');
const hasAccess = require('../utils/hasAccess');

/**
 * Post process file
 * @param  {Object}  request
 * @param  {Object}  request.params
 * @param  {Object}  request.params.filename
 * @param  {Object}  request.params.username
 * @param  {Boolean} request.params.awaitPostActions
 * @return {Promise}
 */
module.exports = function postProcessFile({ params }) {
  const { uploadId, username, awaitPostActions } = params;
  const key = `${FILES_DATA}:${uploadId}`;
  const maxTries = this.config.maxTries;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(hasAccess(username))
    .then((data) => {
      const status = data.status;
      const exportSettings = params.export || data.export;

      if (exportSettings) {
        if (data[exportSettings.format]) {
          throw new HttpStatusError(418, `format "${exportSettings.format}" is already present`);
        }

        if (status === STATUS_PENDING || status === STATUS_PROCESSING) {
          throw new HttpStatusError(409, 'file is being processed or upload has not been finished yet');
        }

        data.export = exportSettings;
      } else if (status !== STATUS_UPLOADED && status !== STATUS_FAILED) {
        throw new HttpStatusError(412, 'file is being processed or upload has not been finished yet');
      }

      if (status === STATUS_FAILED && data[FILES_PROCESS_ERROR_COUNT_FIELD] && data[FILES_PROCESS_ERROR_COUNT_FIELD] >= maxTries) {
        this.log.error({ params }, 'failed to process file', data[FILES_PROCESS_ERROR_FIELD]);
        throw new HttpStatusError(422, 'could not process file');
      }

      return [key, data];
    })
    .spread(postProcess)
    .tap((data) => {
      const prefix = this.config.router.routes.prefix;
      const postActionKey = `${FILES_POST_ACTION}:${uploadId}`;

      // check if we have post actions and perform them
      return this.redis.get(postActionKey).then((postAction) => {
        if (!postAction) return null;

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
          actions.push(this.amqp.publish(`${prefix}.update`, message).catch((e) => {
            this.log.warn({ params, tag: 'post-update' }, 'failed to perform post-update', e);
          }));
        }

        return awaitPostActions ? Promise.all(actions) : null;
      });
    });
};
