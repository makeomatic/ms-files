#!/usr/bin/env node

/* eslint-disable no-console */

// example usage
/*
./bin/simple-upload.js --host="https://some.api.com" \
   -f ./test/fixtures/brulux01 \
   -p ./test/fixtures/brulux01/001.jpg \
   -n Brulux \
   -d "Brulux is the best ring for your future wife" \
   -u "email@example.com" \
   -x "somepassword"
*/
const argv = require('yargs')
  .describe('host', 'api host')
  .describe('f', 'path to folder with models')
  .describe('p', 'preview to this model')
  .describe('n', 'model name')
  .describe('d', 'model description')
  .describe('u', 'username')
  .describe('x', 'password')
  .describe('reverse')
  .boolean(['reverse'])
  .demand(['host', 'f', 'p', 'n', 'd', 'u', 'x'])
  .help('h')
  .argv;

// deps
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const request = require('request-promise');
const glob = require('glob');
const md5 = require('md5');
const path = require('path');

// JSON utility
const parse = JSON.parse.bind(JSON);

// prepare upload
const readFile = type => (filepath) => {
  const file = fs.readFileSync(filepath);

  // meta data
  const meta = {
    type,
    contentType: 'image/jpeg',
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
const modelFiles = glob.sync(`${argv.f}/*.jpg`, { realpath: true });
const previewFile = path.resolve(__dirname, '..', argv.p);

console.info('resolved %d files', modelFiles.length);

if (argv.reverse) {
  console.info('reversing the array...');
  modelFiles.reverse();
}

// models
const preview = readFile('c-preview')(previewFile);
const images = modelFiles.map(readFile('c-simple'));

// message
const uploadMessage = {
  data: {
    type: 'upload',
    attributes: {
      meta: {
        name: argv.n,
        description: argv.d,
      },
      access: {
        setPublic: false,
      },
      uploadType: 'simple',
      resumable: false,
      temp: false,
      unlisted: false,
      files: [preview].concat(images),
    },
  },
};

// perform requests
const authenticate = () => {
  const auth = {
    method: 'post',
    uri: `${argv.host}/api/users/login`,
    headers: {
      'content-type': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        id: argv.u,
        type: 'user',
        attributes: {
          password: String(argv.x),
        },
      },
    }),
    gzip: true,
  };

  return request(auth)
    .then(parse)
    .then(body => body.meta.jwt)
    .tap(() => console.info('authenticated...'));
};

const uploadFile = (meta, idx) => {
  process.stdout.write('.');

  // upload file
  const fileBuffer = uploadMessage.data.attributes.files[idx].file;
  const headers = {
    'Content-MD5': meta.md5Hash,
    'Content-Type': meta.contentType,
  };

  return request.put({
    uri: meta.location,
    body: fileBuffer,
    headers,
  });
};

const uploadFiles = (jwt) => {
  const upload = {
    method: 'post',
    uri: `${argv.host}/api/files`,
    body: JSON.stringify(uploadMessage),
    headers: {
      authorization: `JWT ${jwt}`,
      'content-type': 'application/vnd.api+json',
    },
    gzip: true,
  };

  return request(upload)
    .then(parse)
    .then((body) => {
      console.info('prepared upload %s', body.data.id);

      const files = body.data.attributes.files;
      return Promise
        .map(files, uploadFile, { concurrency: 20 })
        .return(body.data.id);
    });
};

// authenticate & upload
authenticate()
  .then(uploadFiles).then((id) => {
    return console.info(`Finished uploading id: ${id}`);
  })
  .catch(e => setImmediate(() => { throw e; }));
