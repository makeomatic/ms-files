const Promise = require('bluebird');
const { FILES_DATA, FILES_PUBLIC_FIELD } = require('../constant.js');
const { HttpStatusError } = require('common-errors');
const fetchData = require('../utils/fetchData.js');
const hasAccess = require('../utils/hasAccess.js');
const isProcessed = require('../utils/isProcessed.js');

// default signed URL expiration time
const THREE_HOURS = 1000 * 60 * 60 * 3;

/**
 * Get download url
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function getDownloadURL(opts) {
  const { provider, config } = this;
  const { uploadId, username } = opts;
  const { transport: { cname, expire } } = config;
  const key = `${FILES_DATA}:${uploadId}`;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(isProcessed)
    .then(data => {
      // parse file data
      const { name } = data;
      const files = JSON.parse(data.files);

      // check status and if we have public link available - use it
      let urls;
      if (data[FILES_PUBLIC_FIELD]) {
        urls = files.map(file => `${cname}/${encodeURIComponent(file.filename)}`);
      } else if (!username) {
        throw new HttpStatusError(403, 'file does not belong to the provided user');
      } else {
        // will throw if no access
        hasAccess(username)(data);

        // signed URL settings
        const settings = {
          action: 'read',
          // 3 hours
          expires: Date.now() + (expire || THREE_HOURS),
          // resource: filename <- specified per file
        };

        urls = Promise.map(files, file => provider.createSignedURL({ ...settings, resource: file.filename }));
      }

      return Promise.props({ uploadId, name, files, urls });
    });
};
