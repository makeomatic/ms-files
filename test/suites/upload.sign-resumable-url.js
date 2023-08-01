const { strictEqual } = require('assert');
const { startService, stopService } = require('../helpers/utils');

describe('upload with signed resumable url suite', function suite() {
  before('override config', function overrideConfig() {
    // @NOTE it's not really works with process.env
    this.configOverride = {
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
        },
        cname: true,
      }],
    };
  });
  before('start service', startService);
  after('stop service', stopService);

  it('should be able to return signed resumable url', async () => {
    const { amqp } = this.ctx;

    const response = await amqp.publishAndWait('files.upload', {
      username: 'v@makeomatic.ru',
      uploadType: 'simple',
      resumable: true,
      signResumableUrl: true,
      meta: {
        name: 'sign resumable upload example',
      },
      files: [{
        contentType: 'image/jpeg',
        contentLength: 2452676,
        md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
        type: 'c-preview',
      }],
    });

    strictEqual(response.name, 'sign resumable upload example');
    strictEqual(response.uploadId !== undefined, true);
    strictEqual(response.startedAt !== undefined, true);
    strictEqual(response.parts, 1);
    strictEqual(response.contentLength, 2452676);
    strictEqual(response.status, '1');
    strictEqual(response.owner, 'v@makeomatic.ru');
    strictEqual(response.bucket.startsWith('makeomatic-13123'), true);
    strictEqual(response.uploadType, 'simple');

    strictEqual(response.files[0].contentType, 'image/jpeg');
    strictEqual(response.files[0].contentLength, 2452676);
    strictEqual(response.files[0].md5Hash !== undefined, true);
    strictEqual(response.files[0].bucket.startsWith('makeomatic-13123'), true);
    strictEqual(response.files[0].type, 'c-preview');
    strictEqual(response.files[0].filename !== undefined, true);
    strictEqual(response.files[0].location.startsWith('https://makeomatic-13123'), true);

    strictEqual(response.files[1] === undefined, true);
  });
});
