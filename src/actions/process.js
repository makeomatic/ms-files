const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const { STATUS_PROCESSED, FILES_DATA } = require('../constant.js');
const postProcess = require('../utils/process.js');
const fetchData = require('../utils/fetchData.js');

/**
 * Post process file
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function postProcessFile(opts) {
  const { filename, username } = opts;
  const key = `${FILES_DATA}:${filename}`;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(data => {
      if (username && data.owner !== username) {
        throw new HttpStatusError(403, 'file does not belong to the provided user');
      }

      if (data.status === STATUS_PROCESSED) {
        throw new HttpStatusError(412, 'file has already been processed');
      }

      return postProcess.call(this, key, data);
    });
};
