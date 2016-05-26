const Promise = require('bluebird');
const { FILES_DATA, FILES_OWNER_FIELD, FILES_PUBLIC_FIELD } = require('../constant.js');
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
      const { name, files } = data;

      // check status and if we have public link available - use it
      let urls;
      let alias;
      if (data[FILES_PUBLIC_FIELD]) {
        urls = files.map(file => `${cname}/${encodeURIComponent(file.filename)}`);
        // extract alias
        alias = this.hook
          .call(this, 'files:download:alias', data[FILES_OWNER_FIELD])
          .get(0);
      } else if (!username) {
        throw new HttpStatusError(401, 'file does not belong to the provided user');
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

        alias = username;
        urls = Promise.map(files, file => provider().createSignedURL({ ...settings, resource: file.filename }));
      }

      return Promise.props({ uploadId, name, files, urls, username: alias });
    });
};
