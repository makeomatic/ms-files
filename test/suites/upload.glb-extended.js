const { strictEqual, rejects } = require('assert');

const {
  startService,
  stopService,
} = require('../helpers/utils');

describe('upload glb-extended suite', function suite() {
  before('start service', startService);
  after('stop service', stopService);

  it('should be able to upload GLB file', async () => {
    const { amqp } = this.ctx;

    const response = await amqp.publishAndWait('files.upload', {
      username: 'v@makeomatic.ru',
      uploadType: 'glb-extended',
      meta: {
        name: 'glb-extended example',
      },
      files: [{
        contentType: 'image/jpeg',
        contentLength: 2452676,
        md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
        type: 'c-preview',
      }, {
        contentType: 'model/gltf-binary',
        contentLength: 2452676,
        md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
        type: 'c-gltf',
      }],
    });

    strictEqual(response.name, 'glb-extended example');
    strictEqual(response.uploadId !== undefined, true);
    strictEqual(response.startedAt !== undefined, true);
    strictEqual(response.parts, 2);
    strictEqual(response.contentLength, 4905352);
    strictEqual(response.status, '1');
    strictEqual(response.owner, 'v@makeomatic.ru');
    strictEqual(response.bucket.startsWith('makeomatic-13123'), true);
    strictEqual(response.uploadType, 'glb-extended');

    strictEqual(response.files[0].contentType, 'image/jpeg');
    strictEqual(response.files[0].contentLength, 2452676);
    strictEqual(response.files[0].md5Hash !== undefined, true);
    strictEqual(response.files[0].bucket.startsWith('makeomatic-13123'), true);
    strictEqual(response.files[0].type, 'c-preview');
    strictEqual(response.files[0].filename !== undefined, true);
    strictEqual(response.files[0].filename.endsWith('.jpeg'), true);
    strictEqual(response.files[0].location !== undefined, true);
    strictEqual(response.files[0].location.includes('.jpeg'), true);

    strictEqual(response.files[1].contentType, 'model/gltf-binary');
    strictEqual(response.files[1].contentLength, 2452676);
    strictEqual(response.files[1].md5Hash !== undefined, true);
    strictEqual(response.files[1].bucket.startsWith('makeomatic-13123'), true);
    strictEqual(response.files[1].type, 'c-gltf');
    strictEqual(response.files[1].filename !== undefined, true);
    strictEqual(response.files[1].filename.endsWith('.glb'), true);
    strictEqual(response.files[1].location !== undefined, true);
    strictEqual(response.files[1].location.includes('.glb'), true);

    strictEqual(response.files[2] === undefined, true);
  });

  it('should be able to upload GLB+USDZ file', async () => {
    const { amqp } = this.ctx;

    const response = await amqp.publishAndWait('files.upload', {
      username: 'v@makeomatic.ru',
      uploadType: 'glb-extended',
      meta: {
        name: 'glb-extended example',
      },
      files: [{
        contentType: 'image/jpeg',
        contentLength: 2452676,
        md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
        type: 'c-preview',
      }, {
        contentType: 'model/gltf-binary',
        contentLength: 2452676,
        md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
        type: 'c-gltf',
      }, {
        contentType: 'model/vnd.usdz+zip',
        contentLength: 2452676,
        md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
        type: 'c-usdz',
      }],
    });

    strictEqual(response.name, 'glb-extended example');
    strictEqual(response.uploadId !== undefined, true);
    strictEqual(response.startedAt !== undefined, true);
    strictEqual(response.parts, 3);
    strictEqual(response.contentLength, 7358028);
    strictEqual(response.status, '1');
    strictEqual(response.owner, 'v@makeomatic.ru');
    strictEqual(response.bucket.startsWith('makeomatic-13123'), true);
    strictEqual(response.uploadType, 'glb-extended');

    strictEqual(response.files[0].contentType, 'image/jpeg');
    strictEqual(response.files[0].contentLength, 2452676);
    strictEqual(response.files[0].md5Hash !== undefined, true);
    strictEqual(response.files[0].bucket.startsWith('makeomatic-13123'), true);
    strictEqual(response.files[0].type, 'c-preview');
    strictEqual(response.files[0].filename !== undefined, true);
    strictEqual(response.files[0].location !== undefined, true);

    strictEqual(response.files[1].contentType, 'model/gltf-binary');
    strictEqual(response.files[1].contentLength, 2452676);
    strictEqual(response.files[1].md5Hash !== undefined, true);
    strictEqual(response.files[1].bucket.startsWith('makeomatic-13123'), true);
    strictEqual(response.files[1].type, 'c-gltf');
    strictEqual(response.files[1].filename !== undefined, true);
    strictEqual(response.files[1].location !== undefined, true);

    strictEqual(response.files[2].contentType, 'model/vnd.usdz+zip');
    strictEqual(response.files[2].contentLength, 2452676);
    strictEqual(response.files[2].md5Hash !== undefined, true);
    strictEqual(response.files[2].bucket.startsWith('makeomatic-13123'), true);
    strictEqual(response.files[2].type, 'c-usdz');
    strictEqual(response.files[2].filename !== undefined, true);
    strictEqual(response.files[2].filename.endsWith('.usdz'), true);
    strictEqual(response.files[2].location !== undefined, true);
    strictEqual(response.files[2].location.includes('.usdz'), true);

    strictEqual(response.files[3] === undefined, true);
  });

  it('should be able to return an error if the file type is invalid', async () => {
    const { amqp } = this.ctx;

    await rejects(
      amqp.publishAndWait('files.upload', {
        username: 'v@makeomatic.ru',
        uploadType: 'glb-extended',
        meta: {
          name: 'glb-extended example',
        },
        files: [{
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'c-preview',
        }, {
          contentType: 'model/gltf-binary',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'c-glntf', // invalid type
        }],
      }),
      {
        name: 'HttpStatusError',
        // eslint-disable-next-line max-len
        message: 'upload validation failed: data/files/0/type must be equal to constant, data/files/0/contentType must be equal to one of the allowed values, data/files/1/type must be equal to constant, data/files must contain at least 1 and no more than 1 valid item(s), data must match "then" schema, data/files/1 must have required property \'contentEncoding\', data/files/1 must have required property \'decompressedLength\', data/files/1 must have required property \'source-sha256\', data/files/1/type must be equal to constant, data/files/1/contentType must be equal to constant, data/files/1/type must be equal to one of the allowed values, data/files/1/contentType must be equal to one of the allowed values, data/files/1/contentType must be equal to one of the allowed values, data/files/1/type must be equal to constant, data/files/1/contentType must be equal to one of the allowed values, data/files/1/contentLength must be <= 2097152, data/files/1/type must be equal to constant, data/files/1/contentType must be equal to one of the allowed values, data/files/1/type must be equal to constant, data/files/1/contentType must be equal to one of the allowed values, data/files/1/type must match pattern "^c-pack\\d+$", data/files/1/contentType must match pattern "^image/vnd.cappasity(\\+[a-z0-9]*)?$", data/files/1/type must be equal to constant, data/files/1/contentType must be equal to constant, data/files/1/type must be equal to constant, data/files/1/type must be equal to constant, data/files/1/contentType must be equal to one of the allowed values, data/files/1/type must be equal to constant, data/files/1/contentType must be equal to constant, data/files/1/type must be equal to constant, data/files/1/contentType must be equal to constant, data/files/1/type must be equal to constant, data/files/1/contentType must be equal to constant, data/files/1/type must be equal to constant, data/files/1/contentType must be equal to constant, data/files/1/type must be equal to constant, data/files/1/contentType must be equal to constant, data/files/1/type must be equal to constant, data/files/1/contentType must be equal to constant, data/files/1 must match a schema in anyOf',
      }
    );
  });

  it('should be able to return an error if the number of files is invalid', async () => {
    const { amqp } = this.ctx;

    await rejects(
      amqp.publishAndWait('files.upload', {
        username: 'v@makeomatic.ru',
        uploadType: 'glb-extended',
        meta: {
          name: 'glb-extended example',
        },
        files: [{ // invalid count
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'c-preview',
        }, {
          contentType: 'model/gltf-binary',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'c-gltf',
        }, {
          contentType: 'model/vnd.usdz+zip',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'c-usdz',
        }, {
          contentType: 'model/vnd.usdz+zip',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'c-usdz',
        }],
      }),
      {
        name: 'HttpStatusError',
        // eslint-disable-next-line max-len
        message: 'upload validation failed: data/files/0/type must be equal to constant, data/files/0/contentType must be equal to one of the allowed values, data/files/1/type must be equal to constant, data/files/1/contentType must be equal to one of the allowed values, data/files must contain at least 0 and no more than 1 valid item(s), data/files must NOT have more than 3 items, data must match "then" schema',
      }
    );
  });

  it('should be able to return an error if GLB file is missing', async () => {
    const { amqp } = this.ctx;

    await rejects(
      amqp.publishAndWait('files.upload', {
        username: 'v@makeomatic.ru',
        uploadType: 'glb-extended',
        meta: {
          name: 'glb-extended example',
        },
        files: [{ // missing GLB
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'c-preview',
        }, {
          contentType: 'model/vnd.usdz+zip',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'c-usdz',
        }],
      }),
      {
        name: 'HttpStatusError',
        // eslint-disable-next-line max-len
        message: 'upload validation failed: data/files/0/type must be equal to constant, data/files/0/contentType must be equal to one of the allowed values, data/files/1/type must be equal to constant, data/files/1/contentType must be equal to one of the allowed values, data/files must contain at least 1 and no more than 1 valid item(s), data must match "then" schema',
      }
    );
  });

  it('should be able to upload PNG preview', async () => {
    const { amqp } = this.ctx;

    const response = await amqp.publishAndWait('files.upload', {
      username: 'v@makeomatic.ru',
      uploadType: 'glb-extended',
      meta: {
        name: 'glb-extended with png',
      },
      files: [{
        contentType: 'image/png',
        contentLength: 2452676,
        md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
        type: 'c-preview',
      }, {
        contentType: 'model/gltf-binary',
        contentLength: 2452676,
        md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
        type: 'c-gltf',
      }],
    });

    strictEqual(response.name, 'glb-extended with png');
    strictEqual(response.uploadId !== undefined, true);
    strictEqual(response.startedAt !== undefined, true);
    strictEqual(response.parts, 2);
    strictEqual(response.contentLength, 4905352);
    strictEqual(response.status, '1');
    strictEqual(response.owner, 'v@makeomatic.ru');
    strictEqual(response.bucket.startsWith('makeomatic-13123'), true);
    strictEqual(response.uploadType, 'glb-extended');

    strictEqual(response.files[0].contentType, 'image/png');
    strictEqual(response.files[0].contentLength, 2452676);
    strictEqual(response.files[0].md5Hash !== undefined, true);
    strictEqual(response.files[0].bucket.startsWith('makeomatic-13123'), true);
    strictEqual(response.files[0].type, 'c-preview');
    strictEqual(response.files[0].filename !== undefined, true);
    strictEqual(response.files[0].filename.endsWith('.png'), true);
    strictEqual(response.files[0].location !== undefined, true);
    strictEqual(response.files[0].location.includes('.png'), true);
  });
});
