const { ActionTransport } = require('@microfleet/plugin-router');
const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const { FILES_DATA, FILES_OWNER_FIELD, FILES_PUBLIC_FIELD } = require('../constant');
const fetchData = require('../utils/fetch-data');
const hasAccess = require('../utils/has-access');
const isProcessed = require('../utils/is-processed');
const Filenames = require('../utils/filename-generator');

function getDownloadUrls(service, data, files, name, sign = true, headers = {}) {
  const downloadNames = new Filenames(name);
  const urls = [];

  for (const file of files) {
    const provider = service.provider('download', data, file, headers);
    const { filename } = file;

    if (sign) {
      urls.push(
        provider.getDownloadUrlSigned(filename, downloadNames.next(filename))
      );
    } else {
      urls.push(
        provider.getDownloadUrl(filename, downloadNames.next(filename))
      );
    }
  }

  return Promise.all(urls);
}

/**
 * Get download url
 * @param  {Object} opts.params
 * @param  {Object} opts.params.filename
 * @param  {Object} opts.params.username
 * @return {Promise}
 */
async function getDownloadURL({ params, headers: { headers } }) {
  const { uploadId, username, rename, types } = params;

  const key = `${FILES_DATA}:${uploadId}`;

  const data = await Promise
    .bind(this, key)
    .then(fetchData)
    .then(isProcessed);

  const files = Array.isArray(types) && types.length > 0
    ? data.files.filter((file) => types.includes(file.type))
    : data.files;

  // metadata
  const { name } = data;

  // check status and if we have public link available - use it
  let alias;
  let urls;
  if (data[FILES_PUBLIC_FIELD]) {
    // fetch alias
    alias = this.hook('files:download:alias', data[FILES_OWNER_FIELD])
      .then((x) => x[0]);

    // form URLs
    if (rename) {
      urls = getDownloadUrls(this, data, files, name, true, headers);
    } else {
      urls = getDownloadUrls(this, data, files, name, false, headers);
    }

    // no username - throw
  } else if (!username) {
    throw new HttpStatusError(401, 'file does not belong to the provided user');

    // will throw if no access
  } else if (hasAccess(username)(data)) {
    // alias is username, sign URLs
    alias = username;
    urls = getDownloadUrls(this, data, files, name, true, headers);
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
