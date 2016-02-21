const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const { STATUS_PROCESSED, FILES_DATA } = require('../constant.js');
const fetchData = require('../utils/fetchData.js');
const hasAccess = require('../utils/hasAccess.js');

/**
 * Get download url
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function getDownloadURL(opts) {
  const { provider } = this;
  const { filename, username } = opts;
  const key = `${FILES_DATA}:${filename}`;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(hasAccess(username))
    .then(data => {
      if (username && data.status !== STATUS_PROCESSED) {
        throw new HttpStatusError(412, 'your upload has not been processed yet');
      }

      return Promise.props({
        url: provider.createSignedURL({
          action: 'read',
          // 3 hours
          expires: Date.now() + 1000 * 60 * 60 * 3,
          // resource
          resource: filename,
          // filename
          promptSaveAs: data.humanName || 'cappasity-model',
        }),
        data,
      });
    });
};
