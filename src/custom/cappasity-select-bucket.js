// this file contains logic for selecting transport for uploading
// input is upload opts
const {
  FILES_BUCKET_FIELD,
  FILES_TEMP_FIELD,
  PROVIDER_CLOUDFLARE_MISSING_ERROR,
  UPLOAD_TYPE_CLOUDFLARE_STREAM,
} = require('../constant');

const needToUploadToCloudflare = (uploadParams, file) => {
  return uploadParams.uploadType === UPLOAD_TYPE_CLOUDFLARE_STREAM && file && file.type === 'video';
};

const selectCloudflareStreamProvider = (service) => {
  const cloudflareStream = service.providersByAlias['cloudflare-stream'];

  if (!cloudflareStream) {
    throw PROVIDER_CLOUDFLARE_MISSING_ERROR;
  }

  return cloudflareStream;
};

// action handler
// if file is temporary, use provider index `1`
// if it's permanent - use index 0
function uploadSelector(opts, file) {
  if (needToUploadToCloudflare(opts, file)) {
    return selectCloudflareStreamProvider(this);
  }

  return this.providers[opts.temp ? 1 : 0];
}

// downloads can be performed from both public and temp store
// therefore we need to make selection based on the bucket name
//
// Used in the following actions:
//  * download
//  * remove
//  * access
function downloadSelector(opts, file, headers = {}) {
  if (needToUploadToCloudflare(opts, file)) {
    return selectCloudflareStreamProvider(this);
  }

  const bucket = headers['x-cappasity-source'] === 'cn-beijing'
    ? '3dshot'
    : file[FILES_BUCKET_FIELD];

  // backwards-compatibility
  if (!bucket) {
    // if temp - bucket for temp files, else - default bucket
    // operates under assumption that 0 index is always permanent
    // and 1 is always temporary
    return this.providers[opts[FILES_TEMP_FIELD] ? 1 : 0];
  }

  // find the bucket amongst what we have
  const provider = this.providersByBucket[bucket];

  // return provider right away
  if (provider !== undefined) {
    return provider;
  }

  throw new Error(`Bucket "${bucket}" is not defined`);
}

// type map
const ACTION_TO_SELECTOR = Object.setPrototypeOf({
  // upload action is different
  upload: uploadSelector,
  // these are all the same
  access: downloadSelector,
  download: downloadSelector,
  remove: downloadSelector,
  sync: downloadSelector,
}, null);

// fn for selection
function selectTransport(action, opts, file, headers) {
  const thunk = ACTION_TO_SELECTOR[action];

  if (typeof thunk !== 'function') {
    throw new Error(`${action} selector not defined`);
  }

  return thunk.call(this, opts, file, headers);
}

// public API
module.exports = selectTransport;
