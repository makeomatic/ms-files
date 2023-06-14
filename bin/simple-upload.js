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
const { argv } = require('yargs')
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
  .help('help');

// deps
const Promise = require('bluebird');
const { Readable } = require('node:stream');
const fs = Promise.promisifyAll(require('fs'));
const { fetch, getGlobalDispatcher } = require('undici');
const { globSync } = require('glob');
const md5 = require('md5');
const path = require('path');
const omit = require('lodash/omit');
const AMQPTransport = require('@microfleet/transport-amqp');
const { strict: assert } = require('node:assert');
const { initStore } = require('../src/config');

// prepare upload
const readFile = (_type) => (filepath) => {
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
const previewFile = path.resolve(process.cwd(), argv.p);
const modelFiles = globSync(`${argv.f}/*.{jpg,jpeg,pack}`, {
  realpath: true,
  ignore: argv.excludePreview ? [previewFile] : [],
});

if (argv.reverse) {
  console.info('reversing the array...');
  modelFiles.reverse();
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

if (argv.confirm) {
  (async () => {
    // Configuration
    const store = await initStore({ env: process.env.NODE_ENV });
    const config = store.get('/');

    // AMQP adapter
    const amqpConfig = omit(config.amqp.transport, ['queue', 'listen', 'neck', 'onComplete']);
    const { prefix } = config.router.routes;
    const getTransport = () => {
      if (process.env.NODE_ENV === 'test') {
        console.info('establishing connection to amqp with %j', amqpConfig);
      }
      return AMQPTransport.connect({ ...amqpConfig, debug: false });
    };

    /**
     * Uploads File to GCS
     */
    async function uploadFile(meta, idx) {
      // upload file
      const fileBuffer = uploadMessage.files[idx].file;
      const headers = {
        'Content-MD5': meta.md5Hash,
        'Content-Type': meta.contentType,
      };

      if (argv.public) {
        headers['x-goog-acl'] = 'public-read';
      }

      const res = await fetch(meta.location, {
        method: 'PUT',
        body: Readable.from([fileBuffer], { objectMode: false }),
        headers,
        duplex: 'half',
        keepalive: false,
      });

      assert.equal(res.status, 200);
      if (!res.bodyUsed) {
        await res.text();
      }
    }

    /**
     * Reports success of upload
     */
    async function reportSuccess(amqp, meta) {
      process.stdout.write('.');
      try {
        return await amqp.publishAndWait(`${prefix}.finish`, { filename: meta.filename });
      } catch (e) {
        if ([200, 202].indexOf(e.statusCode) >= 0) {
          return 'ok';
        }

        throw e;
      }
    }

    /**
     * Inits upload, sends stuff to GCS, reports finish
     */
    const uploadFiles = async (amqp) => {
      const data = await amqp.publishAndWait(`${prefix}.upload`, uploadMessage);

      await Promise.map(data.files, async (file, idx) => {
        await uploadFile(file, idx);
        await reportSuccess(amqp, file);
      }, { concurrency: 20 });

      console.info(`\n${data.uploadId}`);
    };

    const transport = await getTransport();
    try {
      await uploadFiles(transport);
    } finally {
      await Promise.all([
        getGlobalDispatcher().close(),
        transport.close(),
      ]);
    }
  })();
} else {
  // print upload message
  console.info('Dry run, printing prepared message:\n\n');
  console.info(require('util').inspect(uploadMessage, { depth: 5 }));
}
