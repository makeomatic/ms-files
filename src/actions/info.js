const Promise = require('bluebird');
const fetchData = require('../utils/fetchData.js');

const { NotImplementedError, HttpStatusError } = require('common-errors');
const { FILES_DATA, FILES_OWNER_FIELD, FILES_PUBLIC_FIELD } = require('../constant.js');

/**
 * File information
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function getFileInfo(opts) {
  const { filename } = opts;

  return Promise
    .bind(this, ['files:info:pre', opts.username])
    .spread(this.postHook)
    .spread(username => {
      if (!username) {
        throw new NotImplementedError('files:info:pre hook must be specified to use this endpoint');
      }

      return Promise.props({
        // check for owner later if file is not public
        username,
        // fetch file data
        file: fetchData.call(this, `${FILES_DATA}:${filename}`),
      });
    })
    .then(data => {
      // ref file
      const info = data.file;

      // check access permissions
      if (info[FILES_OWNER_FIELD] !== data.username && !info[FILES_PUBLIC_FIELD]) {
        throw new HttpStatusError(404, 'file not found');
      }

      // parse files
      info.files = JSON.parse(info.files);

      return data;
    });
};
