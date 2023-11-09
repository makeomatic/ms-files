const assert = require('assert');
const md5 = require('md5');
const url = require('url');
const { fetch } = require('undici');
const clone = require('lodash/cloneDeep');

describe('upload suite', function suite() {
  // helpers
  const {
    startService,
    stopService,
    bindSend,
    uploadFiles,
    modelData,
    simpleData,
    simplePackedData,
    owner,
    finishUpload,
    processUpload,
    getInfo,
    meta,
    initAndUpload,
  } = require('../helpers/utils');

  // data
  let bucketName;
  const route = 'files.upload';
  const { STATUS_PENDING, STATUS_PROCESSED, FILES_PACKED_FIELD } = require('../../src/constant');

  // setup functions
  before('start service', async function startAll() {
    const service = await startService.call(this);
    bucketName = service.config.transport[0].options.bucket.name;
  });
  after('stop service', stopService);
  before('helpers', bindSend(route));

  describe('resumable upload suite', function resumableUploadSuite() {
    it('verifies input data and rejects on invalid format', async function test() {
      await assert.rejects(this.send({ ...modelData.message, username: false }));
    });

    it('rejects upload if meta.alias is specified', async function test() {
      await assert.rejects(this.send({
        ...modelData.message,
        meta: {
          ...modelData.message.meta,
          alias: 'sample-alias',
        },
      }));
    });

    it('initiates upload and returns correct response format', async function test() {
      const { message } = modelData;

      const rsp = await this.send(message, 45000);

      assert.equal(rsp.name, message.meta.name);
      assert.equal(rsp.owner, message.username);
      assert.ok(rsp.uploadId);
      assert.ok(rsp.startedAt);
      assert.ok(rsp.files);
      assert.ifError(rsp.public);
      assert.equal(rsp.status, STATUS_PENDING);
      assert.equal(rsp.parts, message.files.length);
      assert.deepEqual(rsp.controlsData, message.meta.controlsData);

      // verify that location is present
      rsp.files.forEach((part) => {
        assert.ok(part.location);

        // verify upoad link
        const location = url.parse(part.location, true);
        assert.equal(location.protocol, 'https:');
        assert.equal(location.hostname, 'storage.googleapis.com');
        assert.equal(location.pathname, `/upload/storage/v1/b/${bucketName}/o`);
        assert.equal(location.query.name, part.filename);
        assert.equal(location.query.uploadType, 'resumable');
        assert.ok(location.query.upload_id);

        // verify that filename contains multiple parts
        const [ownerHash, uploadId, filename] = part.filename.split('/');
        assert.equal(md5(owner), ownerHash);
        assert.equal(rsp.uploadId, uploadId);
        assert.ok(filename);
      });

      // save for the next
      this.response = rsp;
    });

    it('possible to initial directOnly upload', async function test() {
      const { message } = modelData;

      const data = await this.send({ ...message, directOnly: true }, 45000);

      assert.ok(data.direct, 'field direct is not set');
    });

    it('upload is possible based on the returned data', async function test() {
      const resp = await uploadFiles(modelData, this.response);
      for (const body of resp) {
        assert.equal(body.status, 200);
      }
    });

    it('initiates public upload and returns correct response format', async function test() {
      const { message } = modelData;

      const nonNormalizedName = 'ФРЫВЛОФ_absdjkab_123718 hsdkaj12 1278';
      const normalizedName = 'фрывлоф_absdjkab_123718 hsdkaj12 1278';

      const rsp = await this.send({
        ...message,
        meta: {
          ...message.meta,
          name: nonNormalizedName,
        },
        access: {
          setPublic: true,
        },
      }, 45000);

      assert.equal(rsp.name, nonNormalizedName);
      assert.equal(rsp.name_n, normalizedName);
      assert.equal(rsp.owner, message.username);
      assert.ok(rsp.uploadId);
      assert.ok(rsp.startedAt);
      assert.ok(rsp.files);
      assert.ok(rsp.public);
      assert.equal(rsp.status, STATUS_PENDING);
      assert.equal(rsp.parts, message.files.length);

      // verify that location is present
      rsp.files.forEach((part) => {
        assert.ok(part.location);

        // verify upoad link
        const location = url.parse(part.location, true);
        assert.equal(location.protocol, 'https:');
        assert.equal(location.hostname, 'storage.googleapis.com');
        assert.equal(location.pathname, `/upload/storage/v1/b/${bucketName}/o`);
        assert.equal(location.query.name, part.filename);
        assert.equal(location.query.uploadType, 'resumable');
        assert.ok(location.query.upload_id);

        // verify that filename contains multiple parts
        const [ownerHash, uploadId, filename] = part.filename.split('/');
        assert.equal(md5(owner), ownerHash);
        assert.equal(rsp.uploadId, uploadId);
        assert.ok(filename);
      });

      // save for the next
      this.response = rsp;
    });

    it('upload is possible based on the returned data: public', async function test() {
      const resp = await uploadFiles(modelData, this.response);
      for (const req of resp) {
        assert.equal(req.status, 200);
      }
    });

    it('able to download public files right away', async function test() {
      const [file] = this.response.files;
      const res = await fetch(`https://storage.googleapis.com/${bucketName}/${file.filename}`, {
        keepalive: false,
      });
      await res.arrayBuffer();
      assert.equal(res.status, 200);
    });
  });

  describe('packed upload with post-action', function suitePacked() {
    const data = clone(simplePackedData);
    const { message } = data;
    let response;

    it('rejects packed upload with invalid postAction', async function test() {
      await assert.rejects(this.send({
        ...message,
        access: { setPublic: true },
        uploadType: 'simple',
        postAction: {},
      }), {
        statusCode: 400,
        name: 'HttpStatusError',
      });
    });

    it('rejects packed upload with no properties in update postAction', async function test() {
      await assert.rejects(this.send({
        ...message,
        access: { setPublic: true },
        uploadType: 'simple',
        postAction: {
          update: {},
        },
      }), {
        statusCode: 400,
        name: 'HttpStatusError',
      });
    });

    it('creates upload with valid post-action', async function test() {
      const rsp = await this.send({
        ...message,
        access: { setPublic: true },
        uploadType: 'simple',
        postAction: {
          update: {
            alias: 'ban anza',
          },
        },
      });

      response = rsp;
    });

    it('uploads data', async function test() {
      const resp = await uploadFiles(data, response);
      for (const req of resp) {
        assert.equal(req.status, 200);
      }
    });

    it('finishes upload', async function test() {
      await finishUpload.call(this, response);
    });

    it('processes upload and invokes post-action', function test() {
      return processUpload.call(this, response, { awaitPostActions: true });
    });

    it('info returns data based on alias', async function test() {
      const rsp = await getInfo
        .call(this, { filename: 'ban anza', username: message.username });

      assert.equal(rsp.file.status, STATUS_PROCESSED);
      assert.equal(rsp.file[FILES_PACKED_FIELD], '1');
    });
  });

  describe('signed url', function signedURLSuite() {
    let response;

    it('initiates signed URL upload: includes content-encoding', async function test() {
      const { message } = modelData;

      const rsp = await this.send({
        ...message,
        meta: {
          ...meta,
          ...message.meta,
        },
        resumable: false,
        access: {
          setPublic: true,
        },
        uploadType: 'simple',
      });

      assert.equal(rsp.name, message.meta.name);
      assert.equal(rsp.owner, message.username);
      assert.ok(rsp.uploadId);
      assert.ok(rsp.startedAt);
      assert.ok(rsp.files);
      assert.ok(rsp.public);
      assert.equal(rsp.status, STATUS_PENDING);
      assert.equal(rsp.parts, message.files.length);
      assert.deepEqual(rsp.playerSettings, meta.playerSettings);
      assert.deepEqual(rsp.creationInfo, meta.creationInfo);

      // verify that location is present
      let encoding = 0;
      rsp.files.forEach((part) => {
        assert.ok(part.location);

        // verify upload link
        const location = url.parse(part.location, true);
        assert.equal(location.protocol, 'https:');
        assert.equal(location.hostname, 'storage.googleapis.com');
        assert.equal(decodeURIComponent(location.pathname), `/${bucketName}/${part.filename}`);
        assert.ok(location.query['X-Goog-Algorithm'], location);
        assert.ok(location.query['X-Goog-Expires'], location);
        assert.ok(location.query['X-Goog-Credential'], location);
        assert.ok(location.query['X-Goog-Date'], location);
        assert.ok(location.query['X-Goog-Signature'], location);
        assert.ok(location.query['X-Goog-SignedHeaders'], location);

        if (part.contentEncoding) {
          encoding += 1;
          assert(location.query['X-Goog-SignedHeaders'].includes('content-encoding'), location.query['X-Goog-SignedHeaders'])
        }

        // verify that filename contains multiple parts
        const [ownerHash, uploadId, filename] = part.filename.split('/');
        assert.equal(md5(owner), ownerHash);
        assert.equal(rsp.uploadId, uploadId);
        assert.ok(filename);
      });

      assert(encoding > 0, 'no content-encoding present')

      // save for the next
      response = rsp;
    });

    it('initiates signed URL upload', async function test() {
      const { message } = simpleData;

      const rsp = await this.send({
        ...message,
        meta: {
          ...meta,
          ...message.meta,
        },
        resumable: false,
        access: {
          setPublic: true,
        },
        uploadType: 'simple',
      });

      assert.equal(rsp.name, message.meta.name);
      assert.equal(rsp.owner, message.username);
      assert.ok(rsp.uploadId);
      assert.ok(rsp.startedAt);
      assert.ok(rsp.files);
      assert.ok(rsp.public);
      assert.equal(rsp.status, STATUS_PENDING);
      assert.equal(rsp.parts, message.files.length);
      assert.deepEqual(rsp.playerSettings, meta.playerSettings);
      assert.deepEqual(rsp.creationInfo, meta.creationInfo);

      // verify that location is present
      rsp.files.forEach((part) => {
        assert.ok(part.location);

        // verify upload link
        const location = url.parse(part.location, true);
        assert.equal(location.protocol, 'https:');
        assert.equal(location.hostname, 'storage.googleapis.com');
        assert.equal(decodeURIComponent(location.pathname), `/${bucketName}/${part.filename}`);
        assert.ok(location.query['X-Goog-Algorithm'], location);
        assert.ok(location.query['X-Goog-Expires'], location);
        assert.ok(location.query['X-Goog-Credential'], location);
        assert.ok(location.query['X-Goog-Date'], location);
        assert.ok(location.query['X-Goog-Signature'], location);
        assert.ok(location.query['X-Goog-SignedHeaders'], location);

        if (part.contentEncoding) {
          assert(location.query['X-Goog-SignedHeaders'].includes('content-encoding'), location.query['X-Goog-SignedHeaders'])
        }

        // verify that filename contains multiple parts
        const [ownerHash, uploadId, filename] = part.filename.split('/');
        assert.equal(md5(owner), ownerHash);
        assert.equal(rsp.uploadId, uploadId);
        assert.ok(filename);
      });

      // save for the next
      response = rsp;
    });

    it('able to upload files', async function test() {
      const resp = await uploadFiles(simpleData, response);
      for (const req of resp) {
        assert.equal(req.status, 200);
      }
    });

    it('should fail when trying to upload non-resumable upload with resumable modifiers', async function type() {
      const { message } = simpleData;

      await assert.rejects(this.send({
        ...message,
        resumable: false,
        access: {
          setPublic: true,
        },
        unlisted: true,
        temp: true,
      }));
    });
  });

  describe('upload limits', function limitSuite() {
    it('uploading more than 20MB is not allowed if not image/vnd.cappasity', function test() {
      const obj = {
        username: 'any',
        resumable: false,
        files: [{
          type: 'c-simple',
          contentType: 'image/png',
          contentLength: 1024 * 1024 * 21, // 21 MB
          md5Hash: '00000000000000000000000000000000',
        }],
        meta: {
          name: 'test',
        },
      };

      assert.ok(this.files.validator.validateSync('upload', obj).error, 'error not thrown!');
    });

    it('allows to upload > 20MB & < 100MB for image/vnd.cappasity', function test() {
      const obj = {
        username: 'any',
        resumable: false,
        files: [{
          type: 'c-simple',
          contentType: 'image/vnd.cappasity',
          contentLength: 1024 * 1024 * 99, // 99 MB
          md5Hash: '00000000000000000000000000000000',
        }],
        meta: {
          name: 'test',
        },
      };

      assert.ifError(this.files.validator.validateSync('upload', obj).error);
    });

    it('rejects uploading > 100MB for image/vnd.cappasity', function test() {
      const obj = {
        username: 'any',
        resumable: false,
        files: [{
          type: 'c-simple',
          contentType: 'image/vnd.cappasity',
          contentLength: 1024 * 1024 * 101, // 51 MB
          md5Hash: '00000000000000000000000000000000',
        }],
        meta: {
          name: 'test',
        },
      };

      assert.ok(this.files.validator.validateSync('upload', obj).error, 'error not thrown!');
    });
  });

  describe('c-type uploads', function cTypeUploads() {
    it('c-masks', async function test() {
      const msg = {
        files: [{
          contentLength: 3795,
          contentType: 'image/jpeg',
          md5Hash: '6816574b9e4647c3257946838d44be01',
          type: 'c-preview',
        },
        {
          contentLength: 10692,
          contentType: 'image/vnd.cappasity',
          md5Hash: '499da7aeb8324608ee96ef947ae8aefe',
          type: 'c-pack',
        },
        {
          contentLength: 272234,
          contentType: 'image/vnd.cappasity+masks',
          md5Hash: '5acb9db280091d3d506197e0dc662c07',
          type: 'c-masks',
        }],
        access: { setPublic: true },
        directOnly: false,
        meta: {
          backgroundColor: '#FFFFFF',
          backgroundImage: '',
          c_ver: '4.1.0',
          name: 'script_experiment',
          type: 'object',
          dimensions: [0.5, 0.35],
          capabilities: ['ar_3dview', 'web_3dview'],
        },
        postAction: {
          update: {
            alias: 'script_experiment_sku',
          },
        },
        resumable: false,
        temp: false,
        unlisted: false,
        uploadType: 'simple',
        username: 'any',
      };

      await this.send(msg);
    });

    it('c-packs', async function test() {
      const msg = {
        files: [{
          contentLength: 3795,
          contentType: 'image/jpeg',
          md5Hash: '6816574b9e4647c3257946838d44be01',
          type: 'c-preview',
        },
        {
          contentLength: 10692,
          contentType: 'image/vnd.cappasity',
          md5Hash: '499da7aeb8324608ee96ef947ae8aefe',
          type: 'c-pack',
        },
        {
          contentLength: 272234,
          contentType: 'image/vnd.cappasity+2',
          md5Hash: '5acb9db280091d3d506197e0dc662c07',
          type: 'c-pack2',
        }],
        access: { setPublic: true },
        directOnly: false,
        meta: {
          backgroundColor: '#FFFFFF',
          backgroundImage: '',
          c_ver: '4.1.0',
          name: 'script_experiment',
          type: 'object',
          dimensions: [0.5, 0.35],
          capabilities: ['ar_3dview', 'web_3dview'],
        },
        postAction: {
          update: {
            alias: 'script_experiment_sku_2',
          },
        },
        resumable: false,
        temp: false,
        unlisted: false,
        uploadType: 'simple',
        username: 'any',
      };

      await this.send(msg);
    });
  });

  describe('custom fields for metadata', function customMetaSuite() {
    const valid = {
      username: 'any',
      resumable: false,
      files: [{
        type: 'c-simple',
        contentType: 'image/vnd.cappasity',
        contentLength: 1024 * 1024 * 99, // 99 MB
        md5Hash: '00000000000000000000000000000000',
      }],
    };

    it('allows custom fields of type string & number', function test() {
      const obj = {
        ...valid,
        meta: {
          name: 'test',
          c_ver: '1.0.0',
          c_type: 10,
        },
      };

      assert.ifError(this.files.validator.validateSync('upload', obj).error);
    });

    it('rejects types other than string or number', function test() {
      const obj = {
        ...valid,
        meta: {
          name: 'test',
          c_ver: [],
          c_type: false,
          c_dart: {},
        },
      };

      assert.ok(this.files.validator.validateSync('upload', obj).error);
    });

    it('doesnt allow for custom names other than prefixed with c_', function test() {
      const obj = {
        ...valid,
        meta: {
          name: 'test',
          random: '1.0.0',
        },
      };

      assert.ok(this.files.validator.validateSync('upload', obj).error);
    });

    it('validates meta.creationInfo', async function test() {
      const extraProp = {
        ...valid,
        meta: {
          name: 'some',
          creationInfo: {
            extraProp: 1,
          },
        },
      };

      const invalidOsVersion = {
        ...valid,
        meta: {
          name: 'some',
          creationInfo: {
            osVersion: 'a'.repeat(257),
          },
        },
      };

      const invalidOs = {
        ...valid,
        meta: {
          name: 'some',
          creationInfo: {
            os: 'symbian',
          },
        },
      };

      const invalidApplication = {
        ...valid,
        meta: {
          name: 'some',
          creationInfo: {
            application: 'a'.repeat(257),
          },
        },
      };

      const invalidApplicationNumber = {
        ...valid,
        meta: {
          name: 'some',
          creationInfo: {
            application: 42,
          },
        },
      };

      const invalidApplicationVersion = {
        ...valid,
        meta: {
          name: 'some',
          creationInfo: {
            applicationVersion: 'a'.repeat(257),
          },
        },
      };

      const invalidApplicationVersionNumber = {
        ...valid,
        meta: {
          name: 'some',
          creationInfo: {
            applicationVersion: 10,
          },
        },
      };

      const vs = this.files.validator.ifError.bind(this.files.validator);

      assert.throws(() => vs('upload', extraProp), /creationInfo must NOT have additional properties/);
      assert.throws(() => vs('upload', invalidOs), /creationInfo.os must be equal to one of the allowed values/);
      assert.throws(() => vs('upload', invalidOsVersion), /creationInfo.osVersion must NOT have more than 50 characters/);
      assert.throws(() => vs('upload', invalidApplication), /creationInfo.application must NOT have more than 50 characters/);
      assert.throws(() => vs('upload', invalidApplicationNumber), /creationInfo.application must be string/);
      assert.throws(() => vs('upload', invalidApplicationVersion), /creationInfo.applicationVersion must NOT have more than 50 characters/);
      assert.throws(() => vs('upload', invalidApplicationVersionNumber), /creationInfo.applicationVersion must be string/);
    });

    it('validates meta.ar3dviewProps', function test() {
      const invalidShortString = {
        ...valid,
        meta: {
          ar3dviewProps: {
            invalidShortString: '',
          },
        },
      };

      const invalidLongString = {
        ...valid,
        meta: {
          ar3dviewProps: {
            invalidLongString: 'a'.repeat(257),
          },
        },
      };

      const invalidArray = {
        ...valid,
        meta: {
          ar3dviewProps: {
            invalidArray: new Array(39).fill(20, 0, 39),
          },
        },
      };

      const invalidItemArray = {
        ...valid,
        meta: {
          ar3dviewProps: {
            invalidItemArray: [
              { some: 1 },
            ],
          },
        },
      };

      const invalidStringItemArray = {
        ...valid,
        meta: {
          ar3dviewProps: {
            invalidStringItemArray: [
              'a'.repeat(257),
            ],
          },
        },
      };

      const vs = this.files.validator.validateSync.bind(this.files.validator);
      assert(vs('upload', invalidShortString).error.message.match(/invalidShortString/));
      assert(vs('upload', invalidLongString).error.message.match(/invalidLongString/));
      assert(vs('upload', invalidArray).error.message.match(/invalidArray/));
      assert(vs('upload', invalidItemArray).error.message.match(/invalidItemArray/));
      assert(vs('upload', invalidStringItemArray).error.message.match(/invalidStringItemArray/));
    });

    it('validates meta.pWidth/pHeight', function test() {
      const invalidPwh = {
        ...valid,
        meta: {
          name: 'some',
          pWidth: 'foo',
          pHeight: 'foo',
        },
      };

      const missingPw = {
        ...valid,
        meta: {
          name: 'some',
          pHeight: 10,
        },
      };

      const missingPh = {
        ...valid,
        meta: {
          name: 'some',
          pWidth: 10,
        },
      };

      const vs = this.files.validator.validateSync.bind(this.files.validator);

      assert(vs('upload', invalidPwh).error.message.match(/data.meta.pWidth must be integer, data.meta.pHeight must be integer/));
      assert(vs('upload', missingPh).error
        .message.match(/data.meta must have required property 'pHeight', data.meta must match "then" schema/));
      assert(vs('upload', missingPw).error.message.match(/data.meta must have required property 'pWidth', data.meta must match "then" schema/));
    });

    it('validates meta.nft', function test() {
      const invalidNft = {
        ...valid,
        meta: {
          nft: {},
        },
      };
      const vs = this.files.validator.ifError.bind(this.files.validator);

      // eslint-disable-next-line max-len
      assert.throws(() => vs('upload', invalidNft), /validation failed: data\/meta\/nft must have required property 'price', data\/meta\/nft must have required property 'currency', data\/meta\/nft must have required property 'supply', data\/meta\/nft must have required property 'image', data\/meta must have required property 'name'/);
    });
  });

  describe('name normalization', function nameNormSuite() {
    it('normalizes name property on upload', async function nameNormCheck() {
      const uploadResult = await initAndUpload({
        ...modelData,
        message: {
          ...modelData.message,
          meta: {
            ...meta,
            ...modelData.message.meta,
            name: 'Name with Case',
          },
          access: {
            setPublic: true,
          },
        },
      }, false).call({ amqp: this.amqp });

      assert.deepStrictEqual(uploadResult.name, 'Name with Case');
      assert.deepStrictEqual(uploadResult.name_n, 'name with case');
    });
  });

  describe('references', function checkReferencesSute() {
    let referencedModelId;

    before('upload file', async function uploadFile() {
      const referencedUploaded = await initAndUpload({
        ...modelData,
        message: {
          ...modelData.message,
          meta: {
            ...meta,
            ...modelData.message.meta,
          },
          access: {
            setPublic: true,
          },
        },
      }, false).call({ amqp: this.amqp });

      referencedModelId = referencedUploaded.uploadId;
    });

    it('assigns references on upload and after finish', async function checkReferences() {
      const uploadResult = await initAndUpload({
        ...modelData,
        message: {
          ...modelData.message,
          meta: {
            ...meta,
            ...modelData.message.meta,
            references: [referencedModelId],
          },
          access: {
            setPublic: true,
          },
        },
      }, false).call({ amqp: this.amqp });

      assert.deepStrictEqual(uploadResult.references, [referencedModelId]);
      assert.deepStrictEqual(uploadResult.hasReferences, '1');
    });

    it('checks references on upload', async function checkReferences() {
      const uploadResult = this.send({
        ...modelData.message,
        meta: {
          ...meta,
          ...modelData.message.meta,
          references: [referencedModelId],
        },
        access: {
          setPublic: true,
        },
      }, 45000);

      await assert.rejects(uploadResult, /invalid reference/);
    });
  });
});
