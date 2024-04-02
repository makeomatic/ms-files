const fs = require('node:fs/promises');
const path = require('node:path');
const { equal, rejects, match, deepEqual } = require('node:assert/strict');
const md5 = require('md5');
const tus = require('tus-js-client');
const { fetch } = require('undici');
const { validate: validateUuid } = require('uuid');
const { delay } = require('bluebird');

const {
  startService,
  stopService,
} = require('../helpers/utils');

function overrideConfig() {
  this.configOverride = {
    selectTransport: require('../../src/custom/cappasity-select-bucket'),
    transport: [{
      name: 'gce',
      options: {
        gce: {
          projectId: process.env.GCLOUD_PROJECT_ID,
          credentials: {
            client_email: process.env.GCLOUD_PROJECT_EMAIL,
            private_key: process.env.GCLOUD_PROJECT_PK,
          },
        },
        bucket: {
          name: process.env.TEST_BUCKET,
          metadata: {
            location: process.env.GCLOUD_BUCKET_LOCATION || 'EUROPE-WEST1',
            dra: true,
          },
        },
        // test for direct public URLs
      },
      // its not a public name!
      cname: 'gce',
    }, {
      name: 'cloudflare-stream',
      options: {
        accountId: process.env.CLOUDFLARE_STREAM_ACCOUNT_ID,
        apiToken: process.env.CLOUDFLARE_STREAM_API_TOKEN,
        customerSubdomain: process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN,
      },
      keys: [{
        id: process.env.CLOUDFLARE_STREAM_KEY_ID,
        // eslint-disable-next-line max-len
        jwk: process.env.CLOUDFLARE_STREAM_KEY_JWK,
      }],
      expiry: 600,
      urlExpire: 3600,
      maxDurationSeconds: 1800,
    }],
  };
}

const uploadFile = (location, file) => new Promise((resolve, reject) => {
  const upload = new tus.Upload(file, {
    endpoint: location,
    metadata: {
      filename: 'README.md',
      filetype: 'text/plain',
    },
    onError(error) {
      reject(error);
    },
    onSuccess() {
      resolve(upload.url);
    },
  });

  upload.start();
});

describe('upload cloudflare-stream suite', function suite() {
  let filename;
  let provider;
  let uploadId;

  before(overrideConfig);
  before('start service', startService);
  before('get provider', function getProvide() {
    provider = this.files.provider('upload', { uploadType: 'cloudflare-stream' });
  });

  after('stop service', stopService);
  after('remove video', async () => {
    if (filename !== undefined) {
      return provider.remove(filename);
    }

    return null;
  });

  it('should be able to upload video to cloudflare (resumable)', async () => {
    const { amqp } = this.ctx;
    const videoFile = await fs.readFile(path.resolve(__dirname, '../fixtures', 'video_sample.mp4'));

    const response = await amqp.publishAndWait('files.upload', {
      username: 'v@makeomatic.ru',
      uploadType: 'cloudflare-stream',
      meta: {
        name: 'Funny cat video',
      },
      files: [{
        contentType: 'video/mp4',
        contentLength: videoFile.length,
        md5Hash: md5(videoFile).toString('hex'),
        type: 'video',
      }],
    });

    equal(response.name, 'Funny cat video');
    equal(response.name_n, 'funny cat video');
    equal(validateUuid(response.uploadId), true);
    equal(Number.isInteger(response.startedAt), true);
    equal(response.parts, 1);
    equal(response.contentLength, 67328);
    equal(response.status, '1');
    equal(response.owner, 'v@makeomatic.ru');
    equal(response.bucket, process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN);
    equal(response.uploadType, 'cloudflare-stream');

    equal(response.files[0].contentType, 'video/mp4');
    equal(response.files[0].contentLength, 67328);
    equal(response.files[0].md5Hash, 'SOPY6SYV/g1I3Awko1WazQ==');
    equal(response.files[0].bucket, process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN);
    equal(response.files[0].type, 'video');
    equal(response.files[0].filename !== undefined, true);
    equal(response.files[0].location !== undefined, true);

    const { location } = response.files[0];
    const uploadResult = await uploadFile(location, videoFile);

    equal(uploadResult, location);

    filename = response.files[0].filename;
    uploadId = response.uploadId;
  });

  it('should be able to finish processing of the uploaded video', async () => {
    const { amqp } = this.ctx;

    const response = await amqp.publishAndWait('files.finish', {
      filename,
      await: true,
    });

    equal(response.status, '3');
    equal(response.uploaded, '1');
    match(response.uploadedAt, /^\d+$/);
  });

  it('should be able to get error if finish processing of unknown video', async () => {
    const { amqp } = this.ctx;

    await rejects(
      async () => amqp.publishAndWait('files.finish', {
        filename: '55b4953dc4e2371cb742f9c74f825c47',
      }),
      {
        statusCode: 200,
        message: '404: could not find upload',
      }
    );
  });

  it('should be able to get info about uploaded video', async () => {
    const { amqp } = this.ctx;

    const response = await amqp.publishAndWait('files.info', {
      filename: uploadId,
      username: 'v@makeomatic.ru',
    });

    equal(response.username, 'v@makeomatic.ru');
    equal(response.file.uploadId, uploadId);
    match(response.file.uploadedAt, /^\d+$/);
    equal(response.file.contentLength, '67328');
    equal(response.file.status, '3');
    equal(response.file.uploadType, 'cloudflare-stream');
    match(response.file.startedAt, /^\d+$/);
    equal(response.file.parts, '1');
    equal(response.file.bucket, process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN);
    equal(response.file.name, 'Funny cat video');
    equal(response.file.owner, 'v@makeomatic.ru');
    equal(response.file.name_n, 'funny cat video');
    equal(response.file.uploaded, '1');
    equal(response.file.embed, undefined);

    equal(response.file.files[0].contentType, 'video/mp4');
    equal(response.file.files[0].contentLength, 67328);
    equal(response.file.files[0].md5Hash, 'SOPY6SYV/g1I3Awko1WazQ==');
    equal(response.file.files[0].bucket, process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN);
    equal(response.file.files[0].type, 'video');
    equal(response.file.files[0].filename, filename);
  });

  it('should be able to update and get data of uploaded video', async () => {
    const { amqp } = this.ctx;

    const result = await amqp.publishAndWait('files.update', {
      uploadId,
      username: 'v@makeomatic.ru',
      meta: {
        alias: 'stupidogatto',
      },
    });

    equal(result, true);

    const response = await amqp.publishAndWait('files.data', {
      uploadId,
      fields: ['alias'],
    });

    equal(response.file.uploadId, uploadId);
    equal(response.file.alias, 'stupidogatto');
  });

  it('should not be able to clone uploaded video', async () => {
    const { amqp } = this.ctx;

    await rejects(
      async () => amqp.publishAndWait('files.clone', {
        uploadId,
        username: 'v@makeomatic.ru',
      }),
      {
        statusCode: 501,
        message: 'Method \'copy\' is not implemented',
      }
    );
  });

  it('should be able to download uploaded video', async () => {
    const { amqp } = this.ctx;

    const response = await amqp.publishAndWait('files.download', {
      uploadId,
      username: 'v@makeomatic.ru',
    });

    equal(response.uploadId, uploadId);
    equal(response.name, 'Funny cat video');
    equal(response.username, 'v@makeomatic.ru');

    equal(response.files[0].contentType, 'video/mp4');
    equal(response.files[0].contentLength, 67328);
    equal(response.files[0].md5Hash, 'SOPY6SYV/g1I3Awko1WazQ==');
    equal(response.files[0].bucket, process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN);
    equal(response.files[0].type, 'video');
    equal(response.files[0].filename, filename);

    // eslint-disable-next-line max-len
    match(response.urls[0], new RegExp(`^https:\\/\\/${process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN}\\/[A-Za-z0-9]+\\.[A-Za-z0-9]+\\.[A-Za-z0-9-_]+\\/manifest\\/video\\.m3u8$`));

    await delay(10000);

    const { status, headers } = await fetch(response.urls[0]);

    equal(status, 200);
    equal(headers.get('content-type'), 'application/x-mpegURL');
  });

  it('should be able to remove uploaded video', async () => {
    const { amqp } = this.ctx;

    const response = await amqp.publishAndWait('files.remove', {
      filename: uploadId,
      username: 'v@makeomatic.ru',
    });

    deepEqual(response, [1, 1, 1, 1]);

    filename = undefined;
  });
});