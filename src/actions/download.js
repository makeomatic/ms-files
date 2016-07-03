const Promise = require('bluebird');
const { FILES_DATA, FILES_OWNER_FIELD, FILES_PUBLIC_FIELD } = require('../constant.js');
const { HttpStatusError } = require('common-errors');
const fetchData = require('../utils/fetchData.js');
const hasAccess = require('../utils/hasAccess.js');
const isProcessed = require('../utils/isProcessed.js');
const path = require('path');

// default signed URL expiration time
const THREE_HOURS = 1000 * 60 * 60 * 3;

// basename
const Extension = name => path.basename(name).replace(/^[^\.]+\.(.*)$/, '$1');
const PromptToSave = (counter, file, name) => {
  const ext = Extension(file);
  counter[ext] = counter[ext] && ++counter[ext] || 1;
  return `${name}_${counter[ext]}.${ext}`;
};

// url signature
const sign = (provider, files, expire) => {
  // signed URL settings
  const counter = {};
  const settings = {
    action: 'read',
    // 3 hours
    expires: Date.now() + (expire || THREE_HOURS),
    // resource: filename <- specified per file
  };

  return Promise.map(files, file => provider.createSignedURL({
    ...settings,
    resource: file.filename,
    promptSaveAs: PromptToSave(counter, file.filename, name),
  }));
};

/**
 * Get download url
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
module.exports = function getDownloadURL(opts) {
  const { uploadId, username, rename, types } = opts;
  const key = `${FILES_DATA}:${uploadId}`;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(isProcessed)
    .then(data => {
      // parse file data
      const provider = this.provider('download', data);
      const files = types ? data.files.filter(file => types.includes(file.type)) : data.files;

      // metadata
      const { name } = data;
      const { cname, expire } = provider;

      // check status and if we have public link available - use it
      let alias;
      let urls;
      if (data[FILES_PUBLIC_FIELD]) {
        // fetch alias
        alias = this.hook
          .call(this, 'files:download:alias', data[FILES_OWNER_FIELD])
          .get(0);

        // form URLs
        if (rename) {
          urls = sign(provider, files, expire);
        } else {
          urls = files.map(file => `${cname}/${encodeURIComponent(file.filename)}`);
        }

      // no username - throw
      } else if (!username) {
        throw new HttpStatusError(401, 'file does not belong to the provided user');

      // will throw if no access
      } else if (hasAccess(username)(data)) {
        // alias is username, sign URLs
        alias = username;
        urls = sign(provider, files, expire);
      }

      return Promise
        .props({ uploadId, name, files, urls, username: alias })
        .tap(output => this.hook.call(this, 'files:download:post', data, output));
    });
};
