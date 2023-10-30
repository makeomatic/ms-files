/* eslint-disable max-len */

const { strict: assert } = require('assert');
const sinon = require('sinon');
const {
  startService,
  stopService,
} = require('../../helpers/utils');

const { getMocks } = require('../../helpers/mocks');

describe('upload suite', function suite() {
  const route = 'files.upload';

  let ctx;
  let uploadMessage;
  let users;
  let plans;
  let user;
  let metadata;
  let internals;

  before('prepare mocks', async () => {
    ({ users, plans, metadata, internals } = await getMocks());
    ([user] = users);

    uploadMessage = { access: { setPublic: true }, directOnly: false, files: [{ contentLength: 67770, contentType: 'image/jpeg', md5Hash: '45a989419443e78754349f1285a22062', type: 'c-preview' }, { contentLength: 21356, contentType: 'image/vnd.cappasity', md5Hash: '5bbfc40b9c6bfc541fa28d6fe3221c48', type: 'c-pack' }, { contentLength: 6535091, contentType: 'image/vnd.cappasity', md5Hash: 'f881c28fc5086940a4681588aaca160d', type: 'c-pack' }, { contentLength: 9366005, contentType: 'image/vnd.cappasity', md5Hash: '8b82e2e66c1d53aa87a53cd3bfd15d17', type: 'c-pack' }], meta: { backgroundColor: '#FFFFFF', backgroundImage: '', c_ver: '4.1.0', capabilities: ['web_3dview'], creationInfo: { application: 'Easy3DScan', applicationVersion: '1.8.6 (78)', os: 'macos', osVersion: '12.1', props: { type: 'static' } }, name: 'test2', pHeight: 1024, pWidth: 576, playerSettings: { autorotatetime: 10, rotatemode: 'loop', startViewFrame: 0, ttc: 1, reverse: false }, type: 'object' }, postAction: { update: { alias: 'test2' } }, resumable: true, temp: false, unlisted: false, uploadType: 'simple', username: user.id, expires: 900 };

    ctx = {
      configOverride: {
        hooks: {
          'files:upload:pre': require('../../../src/custom/cappasity-upload-pre'),
          'files:upload:post': require('../../../src/custom/cappasity-upload-post'),
          'files:process:pre': require('../../../src/custom/cappasity-process-pre'),
          'files:process:post': [
            require('../../../src/custom/cappasity-process-post'),
            require('../../../src/custom/cappasity-tag-file'),
          ],
          'files:update:pre': require('../../../src/custom/cappasity-update-pre'),
          'files:download:alias': require('../../../src/custom/user-id-to-alias-cappasity'),
          'files:download:post': require('../../../src/custom/cappasity-download-post'),
          'files:info:pre': require('../../../src/custom/alias-to-user-id-cappasity'),
          'files:info:post': require('../../../src/custom/cappasity-info-post'),
        },
        process: {
          prefix: 'test-process',
          postfix: {
            annotate: 'jobs.annotate.request',
            process: 'process',
          },
          timeout: {
            process: 1000 * 60 * 10,
          },
        },
        selectTransport: require('../../../src/custom/cappasity-select-bucket'),
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
          name: 'oss',
          options: {
            accessKeyId: process.env.OSS_ACCESS_KEY_ID,
            accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
            bucket: '3dshot',
            region: 'cn-beijing',
            secure: true,
          },
          cname: 'cdn.3dshot.cn',
          urlExpire: 1000 * 60 * 60 * 3, // 3h
        }],
      },
    };
  });

  // setup functions
  before('start service', async () => {
    const service = await startService.call(ctx);
    const { config } = service;

    ctx.bucketName = config.transport[0].options.bucket.name;

    const amqpStub = sinon
      .stub(service.amqp, 'publishAndWait');

    service.providers.forEach((provider) => {
      if (!provider.exists) return;
      sinon.stub(provider, 'exists').resolves(true);
    });

    const { planGet } = config.payments;
    const { getMetadata, getInternalData } = config.users;

    const plansList = [
      'free',
      'professional',
    ];

    plansList.forEach((id) => {
      amqpStub
        .withArgs(planGet.route, id)
        .resolves(plans[id]);
    });

    users.forEach(({ id, alias }) => {
      amqpStub
        .withArgs(getMetadata, sinon.match({ username: sinon.match(alias).or(sinon.match(id)) }))
        .resolves(metadata[alias]);

      amqpStub
        .withArgs(getInternalData, sinon.match({ username: sinon.match(alias).or(sinon.match(id)) }))
        .resolves(internals[alias]);
    });

    amqpStub.callThrough();
  });
  after('stop service', () => stopService.call(ctx));

  it('correctly processes meta with all hooks', async () => {
    const resp = await ctx.send(route, uploadMessage);
    const { files, uploadId } = resp;

    ctx.files.log.info({ resp }, 'prepare upload message');

    const preProcessedData = await ctx.send('files.info', { filename: uploadId, username: user.id });
    ctx.files.log.info({ preProcessedData }, 'preProcessedData');

    await Promise.allSettled(files.map(async ({ filename }) => (
      ctx.send('files.finish', { filename, await: true })
    )));

    const processedData = await ctx.send('files.info', { filename: uploadId, username: user.id });
    ctx.files.log.info({ processedData }, 'processedData');

    assert(processedData.file.preview);
  });
});
