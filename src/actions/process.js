const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const { STATUS_UPLOADED, FILES_DATA } = require('../constant.js');
const postProcess = require('../utils/process.js');
const fetchData = require('../utils/fetchData.js');

/**
 * Post process file
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function postProcessFile(opts) {
  const { uploadId } = opts;
  const key = `${FILES_DATA}:${uploadId}`;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(data => {
      if (data.status !== STATUS_UPLOADED) {
        throw new HttpStatusError(412, 'file has already been processed or upload has not been finished yet');
      }

      return [key, data];
    })
    .spread(postProcess);
};
