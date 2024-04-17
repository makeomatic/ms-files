const fs = require('node:fs/promises');
const path = require('node:path');
const { equal, rejects, match, deepEqual, ok } = require('node:assert/strict');
const crypto = require('node:crypto');
const md5 = require('md5');
const tus = require('tus-js-client');
const { fetch } = require('undici');
const { validate: validateUuid } = require('uuid');
const { delay } = require('bluebird');
const dotenv = require('dotenv');
const { stub, spy } = require('sinon');

const {
  startService,
  stopService,
} = require('../helpers/utils');
const CloudflareStreamTransport = require('../../src/providers/cloudflare-stream');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const overrideConfig = (config = {}) => function override() {
  this.configOverride = {
    hooks: {
      'files:upload:pre': [],
      // eslint-disable-next-line import/no-dynamic-require
      'files:process:pre': require(`${process.cwd()}/src/custom/cappasity-process-pre`),
      'files:process:post': [],
      'files:info:pre': (alias) => alias,
      'files:update:pre': [],
      'files:download:alias': (username) => username,
      // eslint-disable-next-line import/no-dynamic-require
      'files:info:post': require(`${process.cwd()}/src/custom/cappasity-info-post`),
    },
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
      alias: 'cloudflare-stream',
      name: 'cloudflare-stream',
      options: {
        accountId: process.env.CLOUDFLARE_STREAM_ACCOUNT_ID,
        apiToken: process.env.CLOUDFLARE_STREAM_API_TOKEN,
        customerSubdomain: process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN,
      },
      keys: [{
        id: process.env.CLOUDFLARE_STREAM_KEY_ID,
        jwk: process.env.CLOUDFLARE_STREAM_KEY_JWK,
      }],
      urlExpire: 3600,
      maxDurationSeconds: 1800,
      notificationUrl: 'https://localhost:443',
      alwaysRequireSignedURLs: config.alwaysRequireSignedURLs ?? true,
    }],
  };
};

const uploadFile = async (location, file) => {
  const formData = new FormData();

  formData.append('file', new Blob([file]), 'video.mp4');

  const response = await fetch(location, {
    method: 'POST',
    body: formData,
  });

  return response.text();
};

const uploadFileResumable = (location, file) => new Promise((resolve, reject) => {
  const upload = new tus.Upload(file, {
    endpoint: location,
    metadata: {
      filename: 'video.mp4',
      filetype: 'video/mp4',
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

const getWebhookBody = ({ uid }) => {
  const body = {
    uid,
    creator: null,
    thumbnail: 'https://customer-f33zs165nr7gyfy4.cloudflarestream.com/6b9e68b07dfee8cc2d116e4c51d6a957/thumbnails/thumbnail.jpg',
    thumbnailTimestampPct: 0,
    readyToStream: true,
    status: {
      state: 'ready',
      pctComplete: '39.000000',
      errorReasonCode: '',
      errorReasonText: '',
    },
    meta: {
      filename: 'video.mp4',
      filetype: 'video/mp4',
      name: 'video.mp4',
      relativePath: 'null',
      type: 'video/mp4',
    },
    created: '2022-06-30T17:53:12.512033Z',
    modified: '2022-06-30T17:53:21.774299Z',
    size: 383631,
    preview: 'https://customer-f33zs165nr7gyfy4.cloudflarestream.com/6b9e68b07dfee8cc2d116e4c51d6a957/watch',
    allowedOrigins: [],
    requireSignedURLs: false,
    uploaded: '2022-06-30T17:53:12.511981Z',
    uploadExpiry: '2022-07-01T17:53:12.511973Z',
    maxSizeBytes: null,
    maxDurationSeconds: null,
    duration: 5.5,
    input: {
      width: 560,
      height: 320,
    },
    playback: {
      hls: 'https://customer-f33zs165nr7gyfy4.cloudflarestream.com/6b9e68b07dfee8cc2d116e4c51d6a957/manifest/video.m3u8',
      dash: 'https://customer-f33zs165nr7gyfy4.cloudflarestream.com/6b9e68b07dfee8cc2d116e4c51d6a957/manifest/video.mpd',
    },
    watermark: null,
  };

  return JSON.stringify(body);
};

const getWebhookSignature = (body, key) => {
  const time = Math.floor(Date.now() / 1000);
  const signatureSourceString = `${time}.${body}`;
  const hash = crypto.createHmac('sha256', key).update(signatureSourceString);

  return `time=${time},sig1=${hash.digest('hex')}`;
};

const assertUpload = (response) => {
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
};

const assertDownload = async (response, uploadId, filename, signedURLs = true) => {
  const domain = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN;
  const uid = CloudflareStreamTransport.removeFilenamePrefix(filename);

  equal(response.uploadId, uploadId);
  equal(response.name, 'Funny cat video');
  equal(response.username, 'v@makeomatic.ru');

  equal(response.files[0].contentType, 'video/mp4');
  equal(response.files[0].contentLength, 67328);
  equal(response.files[0].md5Hash, 'SOPY6SYV/g1I3Awko1WazQ==');
  equal(response.files[0].bucket, domain);
  equal(response.files[0].type, 'video');
  equal(response.files[0].filename, filename);

  match(
    response.urls[0],
    // eslint-disable-next-line max-len
    signedURLs
      ? new RegExp(`^https:\\/\\/${domain}\\/[A-Za-z0-9]+\\.[A-Za-z0-9]+\\.[A-Za-z0-9-_]+\\/manifest\\/video\\.m3u8$`)
      : new RegExp(`^https:\\/\\/${domain}\\/${uid}\\/manifest\\/video\\.m3u8$`)
  );

  const { status, headers } = await fetch(response.urls[0]);

  equal(status, 200);
  equal(headers.get('content-type'), 'application/x-mpegURL');
};

const assertInfo = async (response, uploadId, filename, signedURLs = true) => {
  const domain = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN;
  const uid = CloudflareStreamTransport.removeFilenamePrefix(filename);

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
  match(
    response.file.preview,
    // eslint-disable-next-line max-len
    signedURLs
      ? new RegExp(`^https:\\/\\/${domain}\\/[A-Za-z0-9]+\\.[A-Za-z0-9]+\\.[A-Za-z0-9-_]+\\/thumbnails\\/thumbnail\\.jpg$`)
      : new RegExp(`^https:\\/\\/${domain}\\/${uid}\\/thumbnails\\/thumbnail\\.jpg$`)
  );

  equal(response.file.embed, undefined);

  equal(response.file.files[0].contentType, 'video/mp4');
  equal(response.file.files[0].contentLength, 67328);
  equal(response.file.files[0].md5Hash, 'SOPY6SYV/g1I3Awko1WazQ==');
  equal(response.file.files[0].bucket, process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN);
  equal(response.file.files[0].type, 'video');
  equal(response.file.files[0].filename, filename);

  const { status, headers } = await fetch(response.file.preview);

  equal(status, 200);
  equal(headers.get('content-type'), 'image/jpeg');
};

describe('cloudflare-stream suite', () => {
  describe('simple upload', function suite() {
    let filename;
    let provider;
    let uploadId;

    before(overrideConfig());
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

    it('should be able to upload video to cloudflare', async () => {
      const { amqp } = this.ctx;
      const videoFile = await fs.readFile(path.resolve(__dirname, '../fixtures', 'video_sample.mp4'));

      const response = await amqp.publishAndWait('files.upload', {
        username: 'v@makeomatic.ru',
        uploadType: 'cloudflare-stream',
        resumable: false,
        expires: 600,
        origin: 'localhost:433',
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

      assertUpload(response);

      const { location } = response.files[0];
      const uploadResult = await uploadFile(location, videoFile);

      equal(uploadResult, '');

      filename = response.files[0].filename;
      uploadId = response.uploadId;
    });

    it('should be able to finish processing of the uploaded video using webhook', async () => {
      const key = 'secret from the Cloudflare API';
      const body = getWebhookBody({
        uid: CloudflareStreamTransport.removeFilenamePrefix(filename),
      });
      const providerStub = stub(provider, 'webhookSecret').value(key);
      const response = await fetch('http://localhost:3000/files/cloudflare-stream', {
        body,
        method: 'POST',
        headers: {
          'Webhook-Signature': getWebhookSignature(body, key),
        },
      });

      equal(response.status, 200);
      equal(response.statusText, 'OK');

      providerStub.reset();

      await delay(10000);
    });

    it('should be able to get error if finish processing of unknown video', async () => {
      const { amqp } = this.ctx;

      await rejects(
        async () => amqp.publishAndWait('files.finish', {
          filename: 'cfs:55b4953dc4e2371cb742f9c74f825c47',
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

      await assertInfo(response, uploadId, filename);
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

    it('should be able to download uploaded video', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.download', {
        uploadId,
        username: 'v@makeomatic.ru',
      });

      await assertDownload(response, uploadId, filename);
    });

    it('should be able to set public access', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.access', {
        uploadId,
        username: 'v@makeomatic.ru',
        setPublic: true,
      });

      deepEqual(response, [1, 1, 1, 1, 1]);
    });

    it('should be able to download uploaded video public file', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.download', {
        uploadId,
        username: 'v@makeomatic.ru',
      });

      await assertDownload(response, uploadId, filename);
    });

    it('should be able to set private access', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.access', {
        uploadId,
        username: 'v@makeomatic.ru',
        setPublic: false,
      });

      deepEqual(response, [1, 1, 1, 1, 1]);
    });

    it('should be able to download uploaded video private file', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.download', {
        uploadId,
        username: 'v@makeomatic.ru',
      });

      await assertDownload(response, uploadId, filename);
    });

    it('should be able to remove uploaded video', async () => {
      const { amqp } = this.ctx;
      const providerSpy = spy(provider, 'remove');

      const response = await amqp.publishAndWait('files.remove', {
        filename: uploadId,
        username: 'v@makeomatic.ru',
      });

      deepEqual(response, [1, 1, 1, 1]);
      ok(providerSpy.calledOnceWithExactly(filename));

      providerSpy.restore();
      filename = undefined;
    });
  });

  describe('resumable upload', function suite() {
    let filename;
    let provider;
    let uploadId;

    before(overrideConfig());
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
        expires: 600,
        origin: 'localhost:433',
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

      assertUpload(response);

      const { location } = response.files[0];
      const uploadResult = await uploadFileResumable(location, videoFile);

      equal(uploadResult, location);

      filename = response.files[0].filename;
      uploadId = response.uploadId;
    });

    it('should be able to finish processing of the uploaded video using webhook', async () => {
      const key = 'secret from the Cloudflare API';
      const body = getWebhookBody({
        uid: CloudflareStreamTransport.removeFilenamePrefix(filename),
      });
      const providerStub = stub(provider, 'webhookSecret').value(key);
      const response = await fetch('http://localhost:3000/files/cloudflare-stream', {
        body,
        method: 'POST',
        headers: {
          'Webhook-Signature': getWebhookSignature(body, key),
        },
      });

      equal(response.status, 200);
      equal(response.statusText, 'OK');

      providerStub.reset();

      await delay(10000);
    });

    it('should be able to download uploaded video', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.download', {
        uploadId,
        username: 'v@makeomatic.ru',
      });

      await assertDownload(response, uploadId, filename);
    });
  });

  describe('clone file', function suite() {
    let filename;
    let provider;
    let uploadId;
    let clonedUploadId;

    before(overrideConfig());
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

    it('should be able to upload video to cloudflare', async () => {
      const { amqp } = this.ctx;
      const videoFile = await fs.readFile(path.resolve(__dirname, '../fixtures', 'video_sample.mp4'));

      const response = await amqp.publishAndWait('files.upload', {
        username: 'v@makeomatic.ru',
        uploadType: 'cloudflare-stream',
        resumable: false,
        files: [{
          contentType: 'video/mp4',
          contentLength: videoFile.length,
          md5Hash: md5(videoFile).toString('hex'),
          type: 'video',
        }],
        meta: {
          name: 'Funny cat video',
        },
      });

      const { location } = response.files[0];
      const uploadResult = await uploadFile(location, videoFile);

      equal(uploadResult, '');

      filename = response.files[0].filename;
      uploadId = response.uploadId;
    });

    it('should be able to finish processing of the uploaded video using webhook', async () => {
      const key = 'secret from the Cloudflare API';
      const body = getWebhookBody({
        uid: CloudflareStreamTransport.removeFilenamePrefix(filename),
      });
      const providerStub = stub(provider, 'webhookSecret').value(key);
      const response = await fetch('http://localhost:3000/files/cloudflare-stream', {
        body,
        method: 'POST',
        headers: {
          'Webhook-Signature': getWebhookSignature(body, key),
        },
      });

      equal(response.status, 200);
      equal(response.statusText, 'OK');

      providerStub.reset();

      await delay(10000);
    });

    it('should be able to clone uploaded video', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.clone', {
        uploadId,
        username: 'v@makeomatic.ru',
      });

      equal(response.username, 'v@makeomatic.ru');
      equal(validateUuid(response.uploadId), true);

      clonedUploadId = response.uploadId;
    });

    it('should be able to get info about cloned file', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.info', {
        filename: clonedUploadId,
        username: 'v@makeomatic.ru',
      });

      await assertInfo(response, clonedUploadId, filename);
    });

    it('should be able to download uploaded video', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.download', {
        uploadId: clonedUploadId,
        username: 'v@makeomatic.ru',
      });

      await assertDownload(response, clonedUploadId, filename);
    });

    it('should be able to remove file from cloudflare', async () => {
      const { amqp } = this.ctx;
      const providerSpy = spy(provider, 'remove');

      const response = await amqp.publishAndWait('files.remove', {
        filename: uploadId,
        username: 'v@makeomatic.ru',
      });

      deepEqual(response, [1, 1, 1]);
      ok(providerSpy.notCalled);

      providerSpy.restore();
    });
  });

  describe('access (without alwaysRequireSignedURLs, private first)', function suite() {
    let filename;
    let provider;
    let uploadId;

    before(overrideConfig({ alwaysRequireSignedURLs: false }));
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

    it('should be able to upload video to cloudflare', async () => {
      const { amqp } = this.ctx;
      const videoFile = await fs.readFile(path.resolve(__dirname, '../fixtures', 'video_sample.mp4'));

      const response = await amqp.publishAndWait('files.upload', {
        username: 'v@makeomatic.ru',
        uploadType: 'cloudflare-stream',
        resumable: false,
        expires: 600,
        origin: 'localhost:433',
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

      assertUpload(response);

      const { location } = response.files[0];
      const uploadResult = await uploadFile(location, videoFile);

      equal(uploadResult, '');

      filename = response.files[0].filename;
      uploadId = response.uploadId;
    });

    it('should be able to finish processing of the uploaded video using webhook', async () => {
      const key = 'secret from the Cloudflare API';
      const body = getWebhookBody({
        uid: CloudflareStreamTransport.removeFilenamePrefix(filename),
      });
      const providerStub = stub(provider, 'webhookSecret').value(key);
      const response = await fetch('http://localhost:3000/files/cloudflare-stream', {
        body,
        method: 'POST',
        headers: {
          'Webhook-Signature': getWebhookSignature(body, key),
        },
      });

      equal(response.status, 200);
      equal(response.statusText, 'OK');

      providerStub.reset();

      await delay(10000);
    });

    it('should be able to get info about uploaded video', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.info', {
        filename: uploadId,
        username: 'v@makeomatic.ru',
      });

      await assertInfo(response, uploadId, filename);
    });

    it('should be able to download uploaded video', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.download', {
        uploadId,
        username: 'v@makeomatic.ru',
      });

      await assertDownload(response, uploadId, filename);
    });

    it('should be able to set public access', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.access', {
        uploadId,
        username: 'v@makeomatic.ru',
        setPublic: true,
      });

      deepEqual(response, [1, 1, 1, 1, 1]);
    });

    it('should be able to get info about public video', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.info', {
        filename: uploadId,
        username: 'v@makeomatic.ru',
      });

      // Cloudflare has a huge delay when updating the requireSignedURLs property
      await delay(90000);

      await assertInfo(response, uploadId, filename, false);
    });

    it('should be able to download uploaded video public file', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.download', {
        uploadId,
        username: 'v@makeomatic.ru',
      });

      await assertDownload(response, uploadId, filename, false);
    });
  });

  describe('access (without alwaysRequireSignedURLs, public first)', function suite() {
    let filename;
    let provider;
    let uploadId;

    before(overrideConfig({ alwaysRequireSignedURLs: false }));
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

    it('should be able to upload video to cloudflare', async () => {
      const { amqp } = this.ctx;
      const videoFile = await fs.readFile(path.resolve(__dirname, '../fixtures', 'video_sample.mp4'));

      const response = await amqp.publishAndWait('files.upload', {
        username: 'v@makeomatic.ru',
        uploadType: 'cloudflare-stream',
        resumable: false,
        expires: 600,
        origin: 'localhost:433',
        meta: {
          name: 'Funny cat video',
        },
        access: {
          setPublic: true,
        },
        files: [{
          contentType: 'video/mp4',
          contentLength: videoFile.length,
          md5Hash: md5(videoFile).toString('hex'),
          type: 'video',
        }],
      });

      assertUpload(response);

      const { location } = response.files[0];
      const uploadResult = await uploadFile(location, videoFile);

      equal(uploadResult, '');

      filename = response.files[0].filename;
      uploadId = response.uploadId;
    });

    it('should be able to finish processing of the uploaded video using webhook', async () => {
      const key = 'secret from the Cloudflare API';
      const body = getWebhookBody({
        uid: CloudflareStreamTransport.removeFilenamePrefix(filename),
      });
      const providerStub = stub(provider, 'webhookSecret').value(key);
      const response = await fetch('http://localhost:3000/files/cloudflare-stream', {
        body,
        method: 'POST',
        headers: {
          'Webhook-Signature': getWebhookSignature(body, key),
        },
      });

      equal(response.status, 200);
      equal(response.statusText, 'OK');

      providerStub.reset();

      await delay(10000);
    });

    it('should be able to get info about uploaded video', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.info', {
        filename: uploadId,
        username: 'v@makeomatic.ru',
      });

      await assertInfo(response, uploadId, filename, false);
    });

    it('should be able to download uploaded video', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.download', {
        uploadId,
        username: 'v@makeomatic.ru',
      });

      await assertDownload(response, uploadId, filename, false);
    });

    it('should be able to set private access', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.access', {
        uploadId,
        username: 'v@makeomatic.ru',
        setPublic: false,
      });

      deepEqual(response, [1, 1, 1, 1, 1]);
    });

    it('should be able to get info about private video', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.info', {
        filename: uploadId,
        username: 'v@makeomatic.ru',
      });

      await assertInfo(response, uploadId, filename);
    });

    it('should be able to download uploaded video private file', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.download', {
        uploadId,
        username: 'v@makeomatic.ru',
      });

      await assertDownload(response, uploadId, filename);
    });
  });
});
