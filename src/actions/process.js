const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const { STATUS_UPLOADED, STATUS_PROCESSED, STATUS_FAILED, FILES_DATA } = require('../constant.js');
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
      if (data.status !== STATUS_UPLOADED && data.status !== STATUS_PROCESSED && data.status !== STATUS_FAILED) {
        throw new HttpStatusError(412, 'file is being processed or upload has not been finished yet');
      }

      if (exportSettings) {
        if (data[exportSettings.format]) {
          throw new HttpStatusError(418, `format "${exportSettings.format}" is already present`);
        }

        data.export = exportSettings;
      }

      return [key, data];
    })
    .spread(postProcess);
};
