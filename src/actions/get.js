const { NotImplementedError } = require('common-errors');
const Promise = require('bluebird');
const info = require('./info');
const md5 = require('md5');

/**
 * File information
 * @param  {Object} opts.alias
 * @param  {Object} opts.filename
 * @return {Promise}
 */
module.exports = function getFile(opts) {
  const { filename, alias } = opts;

  return Promise
    .bind(this, ['files:get:pre', alias])
    .spread(this.postHook)
    .spread(username => {
      if (!username) {
        throw new NotImplementedError('files:get:pre hook must be specified to use this endpoint');
      }

      const realFilename = `${md5(username)}/${filename}`;
      return Promise
        .bind(this, { filename: realFilename, username })
        .then(info);
    });
};
