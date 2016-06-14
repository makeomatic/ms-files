// this file contains logic for selecting transport for uploading
// input is upload opts
const findIndex = require('lodash/findIndex');
const { FILES_BUCKET_FIELD } = require('../constant.js');

// action handler
// if file is temporary, use provider index `1`
// if it's permanent - use index 0
function uploadSelector({ temp }) {
  return temp ? 1 : 0;
}

// access changes are only available on the persistent store
function accessSelector() {
  return 0;
}

// downloads can be performed from both public and temp store
// therefore we need to make selection based on the bucket name
//
// Used in the following actions:
//  * download
//  * remove
function downloadSelector(opts, config) {
  const transports = config.transport;
  const bucket = opts[FILES_BUCKET_FIELD];

  // backwards-compatibility
  if (!bucket) {
    return 0;
  }

  // new uploads
  return findIndex(transports, transport => transport.options.bucket.name === bucket);
}

// type map
const ACTION_TO_SELECTOR = {
  upload: uploadSelector,
  access: accessSelector,
  download: downloadSelector,
  remove: downloadSelector,
};

// fn for selection
function selectTransport(action, opts) {
  const thunk = ACTION_TO_SELECTOR[action];
  if (!thunk) {
    throw new Error(`${action} selector not defined`);
  }

  return this.providers[thunk(opts, this.config)];
}

// public API
module.exports = selectTransport;
