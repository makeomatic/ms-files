const Promise = require('bluebird');
const fetchData = require('../utils/fetchData.js');

const { NotImplementedError, HttpStatusError } = require('common-errors');
const { FILES_DATA, FILES_OWNER_FIELD } = require('../constant.js');

/**
 * File information
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function getFileInfo(opts) {
  const { filename, username: owner } = opts;

  return Promise
    .bind(this, ['files:info:pre', owner])
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

      // check that owner is a match
      // even in-case with public we want the user to specify username
      if (info[FILES_OWNER_FIELD] !== data.username) {
        throw new HttpStatusError(404, 'file not found');
      }

      // parse files
      info.files = JSON.parse(info.files);

      // rewire owner to requested username
      info.owner = opts.username;

      return data;
    });
};
