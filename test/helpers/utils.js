//
// Contains helpers for uploading files
// and generating metadata for them
//

const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');
const fs = require('fs');
const path = require('path');
const md5 = require('md5');
const request = require('request-promise');
const partial = require('lodash/partial');
const values = require('lodash/values');
const zlib = require('zlib');
const url = require('url');
const is = require('is');
const Files = require('../../src');

// helpers
const cache = {};

// readFile into memory and return it
function readFile(name, alias) {
  const filePath = path.resolve(__dirname, '../fixtures', name);

  if (cache[name]) {
    return cache[name];
  }

  const isDirectory = fs.statSync(filePath).isDirectory();

  let file;
  if (isDirectory) {
    const list = fs.readdirSync(filePath);

    file = list.reduce((acc, filename) => {
      if (!acc[filename]) {
        acc[filename] = readFile(`${filePath}/${filename}`, `${alias}/${filename}`);
      }
      return acc;
    }, {});
  } else {
    file = fs.readFileSync(filePath);
  }

  cache[alias || name] = cache[name] = file;
  return file;
}

// preload files
readFile('shoe.bin.gz', 'model');
readFile('shoe_tex_0.jpg', 'texture-1');
readFile('shoe_tex_1.jpg', 'texture-2');
readFile('shoe_preview.jpg', 'preview');
readFile('background.jpg', 'background');
readFile('brulux01', 'simple');

//
// helper for cappasity model uploader
// generate metadata for uploading
//
function modelMessage(model, textures, preview, owner) {
  const name = 'sku12312131';

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
  const texturesMessage = textures.map((texture) => ({
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
      controlsData: [
        0.25531813502311707, 0.0011256206780672073, 0.06426551938056946,
        -0.001104108989238739, 0.852259635925293, 0.005791602656245232,
        -0.5230863690376282, 0, 0.9999388456344604, 0.011071242392063141,
        0.523118257522583, -0.009435615502297878, 0.8522077798843384,
        0.8522599935531616, 0, 0.5231184363365173, 0, 0.005791574250906706,
        0.9999387264251709, -0.009435582906007767, 0, -0.5230863690376282,
        0.011071248911321163, 0.8522077798843384, 0, -0.13242781162261963,
        0.06709221005439758, 0.21647998690605164, 1,
      ],
      tags: ['ok', 'done'],
      type: 'object',
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

function modelBackgroundImageMessage(background, owner) {
  return {
    files: [background],
    message: {
      username: owner,
      meta: {
        name: 'background',
      },
      files: [{
        type: 'background',
        contentType: 'image/jpeg',
        contentLength: background.length,
        md5Hash: md5(background).toString('hex'),
      }],
      access: {
        setPublic: true,
      },
      temp: false,
      unlisted: false,
    },
  };
}

function modelSimpleUpload({
  simple, preview, owner, ...overwrite
}) {
  const files = values(simple);

  return {
    files: [...files, preview],
    message: {
      username: owner,
      meta: {
        name: 'background',
      },
      files: files
        .map((file) => ({
          type: 'c-simple',
          contentType: 'image/jpeg',
          ...overwrite,
          contentLength: file.length,
          md5Hash: md5(file).toString('hex'),
        }))
        .concat({
          type: 'c-preview',
          contentType: 'image/jpeg',
          contentLength: preview.length,
          md5Hash: md5(preview).toString('hex'),
        }),
      resumable: false,
    },
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

function uploadSimple(meta, file, isPublic) {
  const { query: { Expires } } = url.parse(meta.location);

  const headers = {
    'Content-MD5': meta.md5Hash,
    'Cache-Control': `public,max-age=${Expires}`,
    'Content-Type': meta.contentType,
  };

  if (isPublic) {
    headers['x-goog-acl'] = 'public-read';
  }

  return request.put({
    url: meta.location,
    body: file,
    headers,
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
  const { files } = msg;
  return Promise
    .map(rsp.files, (part, idx) => {
      const file = files[idx];
      const { location } = part;
      const isSimple = location.indexOf('Signature') !== -1;
      return isSimple ? uploadSimple(part, file, rsp.public) : upload(location, file);
    });
}

//
// we will simulate incoming messages
// google will send webhook information, but we can fake them as if we sent them
// `msg` is original message to `upload`
// `rsp` is response to that message
//
function finishMessage(rsp, skipProcessing = true) {
  const { files } = rsp;
  return files.map((file) => ({
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
      .publishAndWait('files.upload', data.message, { timeout: 30000 })
      .tap((rsp) => {
        this.response = rsp;
      })
      .tap((rsp) => uploadFiles(data, rsp));
  };
}

//
// Incorporates uploading message generation
// and upload itself
//
function finishUpload(rsp, skipProcessing = true) {
  const messages = finishMessage(rsp, skipProcessing);
  const { amqp } = this;
  return Promise.map(messages, (it) => {
    return amqp
      .publishAndWait('files.finish', it)
      .catch({ statusCode: 202 }, (err) => err.message);
  });
}

//
// initializes file upload, pushes files to gce and then notifies about file upload
//
function initAndUpload(data, skipProcessing = true) {
  return function uploader() {
    return initUpload(data).call(this)
      .tap((rsp) => finishUpload.call(this, rsp, skipProcessing));
  };
}

//
// Processes file set that finished uploading
//
function processUpload() {
  /* eslint-disable prefer-rest-params */
  let rsp = arguments[0];
  const extra = arguments[1] || {};
  /* eslint-enable prefer-rest-params */

  // this is because mocha will inject cb if it sees function.length > 0
  rsp = is.fn(rsp) || is.undef(rsp) ? this.response : rsp;

  return this.amqp
    .publishAndWait('files.process', { uploadId: rsp.uploadId, ...extra });
}

//
// Set access to a specific file
//
function updateAccess(uploadId, username, setPublic) {
  return this.amqp
    .publishAndWait('files.access', { uploadId, username, setPublic });
}

//
// Download a file
//
function downloadFile({ uploadId, username }) {
  return this.amqp
    .publishAndWait('files.download', { uploadId, username });
}

function getInfo({ filename, username }) {
  return this.amqp
    .publishAndWait('files.info', { filename, username });
}

//
// We want tests to be idempotent, here are the helpers for that
// start service
//
async function startService() {
  const service = this.files = new Files(this.configOverride);
  await service.connect();

  const amqp = this.amqp = service.amqp;
  this.send = function send(route, msg, timeout = 5500) {
    return amqp.publishAndWait(route, msg, { timeout });
  };
}

//
// stop service and cleanup
//
async function stopService() {
  const service = this.files;

  if (service.redisType === 'redisCluster') {
    await Promise.map(service.redis.nodes('master'), (node) => (
      node.flushdb()
    ));
  } else {
    await service.redis.flushdb();
  }

  try {
    await Promise.map(service.providers, (transport) => (
      transport._bucket && transport._bucket.deleteFiles({ force: true })
    ));
  } finally {
    await service.close().reflect();

    this.amqp = null;
    this.files = null;
    this.send = null;
  }
}

// resets sinon
function resetSinon() {
  this.files.config.hooks['files:process:post'].resetHistory();
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
  playerSettings: {
    rotatemode: 'loop',
    ttc: 1.3,
    autorotationtime: 10,
  },
  creationInfo: {
    os: 'macos',
  },
};
const background = readFile('background');
const backgroundData = modelBackgroundImageMessage(background, owner);
const simple = readFile('simple');
const simpleData = modelSimpleUpload({ simple, preview, owner });
const simplePackedData = modelSimpleUpload({
  simple, preview, owner, contentType: 'image/vnd.cappasity', type: 'c-pack',
});

// Public API
module.exports = exports = {
  owner,
  model,
  textures,
  preview,
  background,
  simple,
  modelData,
  backgroundData,
  simpleData,
  simplePackedData,
  upload,
  readFile,
  modelMessage,
  initUpload,
  uploadFiles,
  finishMessage,
  finishUpload,
  processUpload,
  downloadFile,
  getInfo,
  updateAccess,
  inspectPromise,
  startService,
  stopService,
  bindSend,
  initAndUpload,
  meta,
  resetSinon,
};
