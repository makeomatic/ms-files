//
// Contains helpers for uploading files
// and generating metadata for them
//

const Promise = require('bluebird');
const fs = require('fs');
const path = require('path');
const faker = require('faker');
const md5 = require('md5');
const request = require('request-promise');
const assert = require('assert');
const Files = require('../../src');
const config = require('./config.js');
const partial = require('lodash/partial');
const zlib = require('zlib');

// helpers
const cache = {};

// readFile into memory and return it
function readFile(name, alias) {
  const filePath = path.resolve(__dirname, '../fixtures', name);
  if (cache[name]) {
    return cache[name];
  }

  const file = fs.readFileSync(filePath);
  cache[alias || name] = cache[name] = file;
  return file;
}

// preload files
readFile('shoe.bin.gz', 'model');
readFile('shoe_tex_0.jpg', 'texture-1');
readFile('shoe_tex_1.jpg', 'texture-2');
readFile('shoe_preview.jpg', 'preview');

//
// helper for cappasity model uploader
// generate metadata for uploading
//
function modelMessage(model, textures, preview, owner) {
  const name = faker.commerce.productName();

  // generate model metadata
  const binaryMessage = {
    type: 'c-bin',
    contentType: 'application/octet-stream',
    contentLength: model.length,
    decompressedLength: zlib.gunzipSync(model).length,
    contentEncoding: 'gzip',
    md5Hash: md5(model).toString('hex'),
    'source-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  };

  // generate textures metadata
  const texturesMessage = textures.map(texture => ({
    type: 'c-texture',
    contentType: 'image/jpeg',
    contentLength: texture.length,
    md5Hash: md5(texture).toString('hex'),
  }));

  // preview for the model
  const previewMessage = {
    type: 'c-preview',
    contentType: 'image/jpeg',
    contentLength: preview.length,
    md5Hash: md5(preview).toString('hex'),
  };

  const message = {
    username: owner,
    meta: {
      name,
    },
    files: [
      binaryMessage,
      ...texturesMessage,
      previewMessage,
    ],
  };

  return {
    files: [model, ...textures, preview],
    message,
  };
}

//
// upload single file
//
function upload(location, file) {
  return request.put({
    url: location,
    body: file,
    headers: {
      'content-length': file.length,
    },
    simple: false,
    resolveWithFullResponse: true,
  });
}

//
// Uploads files based on the returned message from `upload` endpoint
// `msg` is original message to `upload`
// `rsp` is response to that message
//
function uploadFiles(msg, rsp) {
  const files = msg.files;
  return Promise
    .map(rsp.files, (part, idx) => {
      const file = files[idx];
      const location = part.location;
      return upload(location, file);
    });
}

//
// we will simulate incoming messages
// google will send webhook information, but we can fake them as if we sent them
// `msg` is original message to `upload`
// `rsp` is response to that message
//
function finishMessage(rsp, skipProcessing = true) {
  const files = rsp.files;
  return files.map(file => ({
    filename: file.filename,
    skipProcessing,
    await: true,
  }));
}

//
// Initializes upload
//
function initUpload(data) {
  return function init() {
    return this.amqp
      .publishAndWait('files.upload', data.message, { timeout: 10000 })
      .tap(rsp => {
        this.response = rsp;
      })
      .tap(rsp => uploadFiles(data, rsp));
  };
}

//
// Incorporates uploading message generation
// and upload itself
//
function finishUpload(rsp, skipProcessing = true) {
  const messages = finishMessage(rsp, skipProcessing);
  const amqp = this.amqp;
  return Promise.map(messages, it => {
    return amqp
      .publishAndWait('files.finish', it)
      .catch({ statusCode: 202 }, err => err.message);
  });
}

//
// initializes file upload, pushes files to gce and then notifies about file upload
//
function initAndUpload(data, skipProcessing = true) {
  return function uploader() {
    return initUpload(data).call(this)
      .tap(rsp => finishUpload.call(this, rsp, skipProcessing));
  };
}

//
// Processes file set that finished uploading
//
function processUpload(rsp) {
  return this.amqp
    .publishAndWait('files.process', { uploadId: rsp.uploadId });
}

//
// Set access to a specific file
//
function updateAccess(uploadId, username, setPublic) {
  return this.amqp
    .publishAndWait('files.access', { uploadId, username, setPublic });
}

//
// Simple sync helper for promise inspection
//
function inspectPromise(mustBeFulfilled = true) {
  return function inspection(promise) {
    const isFulfilled = promise.isFulfilled();
    assert.equal(promise.isPending(), false, 'promise was still pending');
    assert.equal(promise.isCancelled(), false, 'promise was cancelled');

    try {
      // we expected the promise to fail or succeed
      assert.equal(isFulfilled, mustBeFulfilled);
    } catch (e) {
      if (isFulfilled) {
        const message = JSON.stringify(promise.value());
        return Promise.reject(new Error(`Promise did not fail: ${message}`));
      }

      throw promise.reason();
    }


    return mustBeFulfilled ? promise.value() : promise.reason();
  };
}

//
// We want tests to be idempotent, here are the helpers for that
// start service
//
function startService() {
  const service = this.files = new Files(config);
  return service
    .connect()
    .tap(() => {
      const amqp = this.amqp = service.amqp;
      this.send = function send(route, msg, timeout = 1500) {
        return amqp.publishAndWait(route, msg, { timeout });
      };
    });
}

//
// stop service and cleanup
//
function stopService() {
  const service = this.files;
  return Promise
    .map(service.redis.nodes('master'), node => node.flushdb())
    .finally(() => Promise
      .map(service.providers, transport => Promise.fromNode(next => (
        transport._bucket.deleteFiles({ force: true }, next)
      ))
    ))
    .finally(() => service.close())
    .finally(() => {
      this.amqp = null;
      this.files = null;
      this.send = null;
    });
}

//
// bind send to specific route
//
function bindSend(route) {
  return function binder() {
    const _send = this.send;
    this.send = partial(_send, route);
  };
}

// pre-cache data
const owner = 'v@makeomatic.ru';
const model = readFile('model');
const textures = [readFile('texture-1'), readFile('texture-2')];
const preview = readFile('preview');
const modelData = modelMessage(model, textures, preview, owner);
const meta = {
  name: 'name',
  description: 'description',
  tags: ['tag1', 'tag2', 'tag3'],
  website: 'http://website.com',
};

// Public API
module.exports = exports = {
  owner,
  model,
  textures,
  preview,
  modelData,
  config,
  upload,
  readFile,
  modelMessage,
  initUpload,
  uploadFiles,
  finishMessage,
  finishUpload,
  processUpload,
  updateAccess,
  inspectPromise,
  startService,
  stopService,
  bindSend,
  initAndUpload,
  meta,
};
