const Promise = require('bluebird');
const fetchData = require('../utils/fetchData');
const resolveFilename = require('../utils/resolveFilename');

const { NotImplementedError, HttpStatusError } = require('common-errors');
const { FILES_DATA, FILES_OWNER_FIELD } = require('../constant');

/**
 * File information
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function getFileInfo({ params }) {
  const { filename: possibleFilename, username: owner } = params;

  return Promise
    .bind(this, ['files:info:pre', owner])
    .spread(this.hook)
    .spread((username) => {
      if (!username) {
        throw new NotImplementedError('files:info:pre hook must be specified to use this endpoint');
      }

      return Promise.props({
        username,
        filename: resolveFilename.call(this, possibleFilename, username),
      });
    })
    .then(data => Promise.props({
      username: data.username,
      file: fetchData.call(this, `${FILES_DATA}:${data.filename}`),
    }))
    .then((data) => {
      // ref file
      const info = data.file;

      // check that owner is a match
      // even in-case with public we want the user to specify username
      if (info[FILES_OWNER_FIELD] !== data.username) {
        throw new HttpStatusError(401, 'please sign as an owner of this model to access it');
      }

      // rewire owner to requested username
      info.owner = owner;

      return data;
    })
    .tap(data => this.hook.call(this, 'files:info:post', data.file));
};
