const Promise = require('bluebird');
const moment = require('moment');
const { STATUS_UPLOADED, FILES_OWNER_FIELD } = require('./constant');

/**
 * Invoke this method to start post-processing of all pending files
 * @return {Promise}
 */
module.exports = function postProcess(offset = 0, uploadedAt) {
  const { prefix } = this.config.router.routes;
  const filter = {
    status: {
      eq: STATUS_UPLOADED,
    },
    uploadedAt: {
      lte: uploadedAt || moment().subtract(1, 'hour').valueOf(),
    },
  };

  return this.router
    .dispatch(`${prefix}.list`, {
      headers: {},
      query: {},
      // payload
      params: { filter, limit: 20, offset },
      transport: 'amqp',
      method: 'amqp',
    })
    .then((data) => {
      const {
        files, cursor, page, pages,
      } = data;

      return Promise.resolve(files).mapSeries((file) => (
        // make sure to call reflect so that we do not interrupt the procedure
        this.router.dispatch(`${prefix}.process`, {
          headers: {},
          query: {},
          // payload
          params: {
            uploadId: file.id,
            username: file[FILES_OWNER_FIELD],
          },
          transport: 'amqp',
          method: 'amqp',
        })
          .reflect()
          .tap((result) => {
            this.log.info({ owner: file[FILES_OWNER_FIELD] }, '%s |', file.id, result.isFulfilled() ? 'processed' : result.reason());
          })
      ))
        .then(() => {
          if (page < pages) {
            return postProcess.call(this, cursor, filter.uploadedAt.lte);
          }

          return null;
        });
    })
    .then(() => {
      this.log.info('completed files post-processing');
      return null;
    });
};
