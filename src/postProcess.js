const Promise = require('bluebird');
const moment = require('moment');
const listFiles = require('./actions/list.js');
const { STATUS_UPLOADED, FILES_DATA } = require('./constant.js');

/**
 * Invoke this method to start post-processing of all pending files
 * @return {Promise}
 */
module.exports = function postProcess(offset = 0, uploadedAt) {
  const filter = {
    status: {
      eq: STATUS_UPLOADED,
    },
    uploadedAt: {
      lte: uploadedAt || moment().subtract(1, 'hour').valueOf(),
    },
  };

  return listFiles
    .call(this, { filter, limit: 20, offset })
    .then(data => {
      const { files, cursor, page, pages } = data;

      return Promise
        .resolve(files)
        .mapSeries(file => {
          // make sure to call reflect so that we do not interrupt the procedure
          return postProcess
            .call(this, `${FILES_DATA}:${file.id}`, file)
            .reflect()
            .tap(result => {
              this.log.info({ owner: file.owner }, '%s |', file.id, result.isFulfilled() ? 'processed' : result.reason());
            });
        })
        .then(() => {
          if (page < pages) {
            return this.postProcess(cursor, filter.uploadedAt.lte);
          }

          return null;
        });
    })
    .then(() => {
      this.log.info('completed files post-processing');
    });
};
