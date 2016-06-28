const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const { STATUS_PENDING, STATUS_PROCESSING, STATUS_UPLOADED, STATUS_FAILED, FILES_DATA } = require('../constant.js');
const postProcess = require('../utils/process.js');
const fetchData = require('../utils/fetchData.js');

/**
 * Post process file
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function postProcessFile(opts) {
  const { uploadId, export: exportSettings } = opts;
  const key = `${FILES_DATA}:${uploadId}`;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(data => {
      const status = data.status;

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

      return [key, data];
    })
    .spread(postProcess);
};
