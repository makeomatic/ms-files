#!/usr/bin/env node

/* eslint-disable no-console */

// example usage
/*
./bin/simple-upload.js \
   -f ./test/fixtures/brulux01 \
   -p ./test/fixtures/brulux01/001.jpg \
   -n Brulux \
   -d "Brulux is the best ring for your future wife" \
   -u "email@example.com"
*/
const argv = require('yargs')
  .option('folder', {
    alias: 'f',
    description: 'path to folder with models',
    demandOption: true,
  })
  .option('username', {
    alias: 'u',
    description: 'owner/username',
    demandOption: true,
  })
  .option('preview', {
    alias: 'p',
    description: 'preview to this model',
    demandOption: true,
  })
  .option('name', {
    alias: 'n',
    description: 'model name',
    demandOption: true,
  })
  .option('description', {
    alias: 'd',
    description: 'model description',
  })
  .option('public', {
    boolean: true,
    default: false,
    description: 'set upload to public',
  })
  .option('reverse', {
    boolean: true,
    default: false,
    description: 'reverse order of images',
  })
  .option('exclude-preview', {
    boolean: true,
    default: false,
    description: 'exclude preview if it is located in folder',
  })
  .option('report-finish', {
    boolean: true,
    default: true,
    description: 'reports finish of uploading',
  })
  .option('confirm', {
    boolean: true,
    default: false,
    description: 'confirm upload',
  })
  .help('help')
  .argv;

// deps
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const request = require('request-promise');
const glob = require('glob');
const md5 = require('md5');
const path = require('path');
const omit = require('lodash/omit');
const AMQPTransport = require('@microfleet/transport-amqp');
const config = require('../lib/config').get('/', { env: process.env.NODE_ENV });

// AMQP adapter
const amqpConfig = omit(config.amqp.transport, ['queue', 'listen', 'neck', 'onComplete']);
const prefix = config.router.routes.prefix;
const getTransport = () => {
  console.info('establishing connection to amqp with %j', amqpConfig);
  return AMQPTransport.connect(amqpConfig).disposer(amqp => amqp.close());
};

// prepare upload
const readFile = _type => (filepath) => {
  const file = fs.readFileSync(filepath);
  const ext = path.extname(filepath);
  const type = _type || (ext === '.pack' ? 'c-pack' : 'c-simple');

  // meta data
  const meta = {
    type,
    contentType: `image/${ext === '.pack' ? 'vnd.cappasity' : 'jpeg'}`,
    contentLength: file.length,
    md5Hash: md5(file).toString('hex'),
  };

  // so it's non-enumerable
  Object.defineProperty(meta, 'file', {
    value: file,
  });

  return meta;
};

// paths
const previewFile = path.resolve(__dirname, '..', argv.p);
let modelFiles = glob.sync(`${argv.f}/*.{jpg,jpeg,pack}`, { realpath: true });

if (argv.reverse) {
  console.info('reversing the array...');
  modelFiles.reverse();
}

if (argv.excludePreview) {
  modelFiles = modelFiles.filter(it => (it !== previewFile));
}

console.info('resolved %d file(s)', modelFiles.length);

// models
const preview = readFile('c-preview')(previewFile);
const images = modelFiles.map(readFile());

// message
const uploadMessage = {
  username: argv.u,
  meta: {
    name: argv.n,
  },
  access: {
    setPublic: argv.public,
  },
  uploadType: 'simple',
  resumable: false,
  temp: false,
  unlisted: false,
  files: [preview].concat(images),
};

// add description if needed
if (argv.d) {
  uploadMessage.meta.description = argv.d;
}

/**
 * Uploads File to GCS
 */
function uploadFile(meta, idx) {
  // upload file
  const fileBuffer = uploadMessage.files[idx].file;
  const headers = {
    'Content-MD5': meta.md5Hash,
    'Content-Type': meta.contentType,
  };

  if (argv.public) {
    headers['x-goog-acl'] = 'public-read';
  }

  return request.put({
    uri: meta.location,
    body: fileBuffer,
    headers,
  });
}

/**
 * Reports success of upload
 */
function reportSuccess(meta) {
  process.stdout.write('.');
  return this
    .publishAndWait(`${prefix}.finish`, { filename: meta.filename })
    .catchReturn(e => [200, 202].indexOf(e.statusCode) >= 0, 'ok');
}

/**
 * Inits upload, sends stuff to GCS, reports finish
 */
const uploadFiles = amqp => (
  amqp
    .publishAndWait(`${prefix}.upload`, uploadMessage)
    .then(data => Promise.props({
      data,
      uploadFiles: Promise
        .bind(amqp, data.files)
        .map(uploadFile, { concurrency: 20 })
        .return(data.files)
        .map(reportSuccess),
    }))
    .get('data')
    .get('uploadId')
    .then(id => console.info(`\n${id}`))
);

if (argv.confirm) {
  Promise.using(getTransport(), uploadFiles);
} else {
  // print upload message
  console.info('Dry run, printing prepared message:\n\n');
  console.info(require('util').inspect(uploadMessage, { depth: 5 }));
}
