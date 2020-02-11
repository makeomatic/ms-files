const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const path = require('path');
const { HttpStatusError } = require('common-errors');
const { encodeURI } = require('@google-cloud/storage/build/src/util');
const { FILES_DATA, FILES_OWNER_FIELD, FILES_PUBLIC_FIELD } = require('../constant');
const fetchData = require('../utils/fetch-data');
const hasAccess = require('../utils/has-access');
const isProcessed = require('../utils/is-processed');

// default signed URL expiration time
const THREE_HOURS = 1000 * 60 * 60 * 3;

// basename
const extReplacer = /^[^.]+\.(.*)$/;
const Extension = (name) => path.basename(name).replace(extReplacer, '$1');
const PromptToSave = (counter, file, name) => {
  const originalExt = Extension(file);

  // NOTE: safari filename fix for ignoring content-type
  // when content-disposition is set
  const ext = originalExt === 'bin.gz'
    ? 'txt'
    : originalExt;

  const val = (counter[ext] || 0) + 1;
  counter[ext] = val;
  return `${name}_${val}.${ext}`;
};

// url signature
const sign = (provider, files, name, expire) => {
  // signed URL settings
  const counter = {};
  const settings = {
    action: 'read',
    // 3 hours
    expires: Date.now() + (expire || THREE_HOURS),
    // resource: filename <- specified per file
  };

  return Promise.map(files, (file) => provider.createSignedURL({
    ...settings,
    resource: file.filename,
    promptSaveAs: PromptToSave(counter, file.filename, name),
  }));
};

/**
 * Get download url
 * @param  {Object} opts.params
 * @param  {Object} opts.params.filename
 * @param  {Object} opts.params.username
 * @return {Promise}
 */
async function getDownloadURL({ params }) {
  const { uploadId, username, rename, types } = params;
  const key = `${FILES_DATA}:${uploadId}`;

  const data = await Promise
    .bind(this, key)
    .then(fetchData)
    .then(isProcessed);

  // parse file data
  const provider = this.provider('download', data);
  const files = (types && types.length > 0)
    ? data.files.filter((file) => types.includes(file.type))
    : data.files;

  // metadata
  const { name } = data;
  const { cname, expire } = provider;

  // check status and if we have public link available - use it
  let alias;
  let urls;
  if (data[FILES_PUBLIC_FIELD]) {
    // fetch alias
    alias = this.hook('files:download:alias', data[FILES_OWNER_FIELD])
      .then((x) => x[0]);

    // form URLs
    if (rename) {
      urls = sign(provider, files, name, expire);
    } else {
      urls = files.map((file) => `${cname}/${encodeURI(file.filename, false)}`);
    }

  // no username - throw
  } else if (!username) {
    throw new HttpStatusError(401, 'file does not belong to the provided user');

  // will throw if no access
  } else if (hasAccess(username)(data)) {
    // alias is username, sign URLs
    alias = username;
    urls = sign(provider, files, name, expire);
  }

  const response = await Promise.props({
    uploadId,
    name,
    files,
    urls,
    username: alias,
  });

  await this.hook('files:download:post', data, response);

  return response;
}

getDownloadURL.transports = [ActionTransport.amqp];

module.exports = getDownloadURL;
