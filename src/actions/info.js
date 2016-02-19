const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const { FILES_DATA, UPLOAD_DATA } = require('../constant.js');
const fetchData = require('../utils/fetchData.js');

/**
 * File information
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function getFileInfo(opts) {
  const { filename, username, uploadId } = opts;
  const key = filename ? `${FILES_DATA}:${filename}` : `${UPLOAD_DATA}:${uploadId}`;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(data => {
      if (username && data.owner !== username) {
        throw new HttpStatusError(403, 'upload does not belong to the provided user');
      }

      return data;
    });
};
