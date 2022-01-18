const { strictEqual, rejects } = require('assert');

const {
  startService,
  stopService,
} = require('../helpers/utils');

describe('upload panorama suite', function suite() {
  before('start service', startService);
  after('stop service', stopService);

  describe('equirect', () => {
    it('should be able to upload file', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.upload', {
        username: 'v@makeomatic.ru',
        uploadType: 'pano-equirect',
        meta: {
          name: 'pano-equirect exmaple',
        },
        files: [{
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'c-preview',
        }, {
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'pano-equirect-image',
        }],
      });

      strictEqual(response.name, 'pano-equirect exmaple');
      strictEqual(response.uploadId !== undefined, true);
      strictEqual(response.startedAt !== undefined, true);
      strictEqual(response.parts, 2);
      strictEqual(response.contentLength, 4905352);
      strictEqual(response.status, '1');
      strictEqual(response.owner, 'v@makeomatic.ru');
      strictEqual(response.bucket.startsWith('makeomatic-13123'), true);
      strictEqual(response.uploadType, 'pano-equirect');

      strictEqual(response.files[0].contentType, 'image/jpeg');
      strictEqual(response.files[0].contentLength, 2452676);
      strictEqual(response.files[0].md5Hash !== undefined, true);
      strictEqual(response.files[0].bucket.startsWith('makeomatic-13123'), true);
      strictEqual(response.files[0].type, 'c-preview');
      strictEqual(response.files[0].filename !== undefined, true);
      strictEqual(response.files[0].location !== undefined, true);

      strictEqual(response.files[1].contentType, 'image/jpeg');
      strictEqual(response.files[1].contentLength, 2452676);
      strictEqual(response.files[1].md5Hash !== undefined, true);
      strictEqual(response.files[1].bucket.startsWith('makeomatic-13123'), true);
      strictEqual(response.files[1].type, 'pano-equirect-image');
      strictEqual(response.files[1].filename !== undefined, true);
      strictEqual(response.files[1].location !== undefined, true);

      strictEqual(response.files[2] === undefined, true);
    });

    it('should be able to return an error if the file type is invalid', async () => {
      const { amqp } = this.ctx;

      await rejects(amqp.publishAndWait('files.upload', {
        username: 'v@makeomatic.ru',
        uploadType: 'pano-equirect',
        meta: {
          name: 'pano-equirect exmaple',
        },
        files: [{
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'c-preview',
        }, {
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'pano-cubemap-image', // invalid type
        }],
      }), 'HttpStatusError: upload validation failed: data.files[0].type should be equal to constant');
    });

    it('should be able to return an error if the number of files is invalid', async () => {
      const { amqp } = this.ctx;

      await rejects(amqp.publishAndWait('files.upload', {
        username: 'v@makeomatic.ru',
        uploadType: 'pano-equirect',
        meta: {
          name: 'pano-equirect exmaple',
        },
        files: [{ // invalid count
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'c-preview',
        }, {
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'pano-equirect-image',
        }, {
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'pano-equirect-image',
        }],
      }), 'HttpStatusError: upload validation failed: data.files should NOT have more than 1 items');
    });
  });

  describe('cubemap', () => {
    it('should be able to upload file', async () => {
      const { amqp } = this.ctx;

      const response = await amqp.publishAndWait('files.upload', {
        username: 'v@makeomatic.ru',
        uploadType: 'pano-cubemap',
        meta: {
          name: 'pano-cubemap exmaple',
        },
        files: [{
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'c-preview',
        }, {
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'pano-cubemap-image',
        }, {
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'pano-cubemap-image',
        }, {
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'pano-cubemap-image',
        }, {
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'pano-cubemap-image',
        }, {
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'pano-cubemap-image',
        }, {
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'pano-cubemap-image',
        }],
      });

      strictEqual(response.name, 'pano-cubemap exmaple');
      strictEqual(response.uploadId !== undefined, true);
      strictEqual(response.startedAt !== undefined, true);
      strictEqual(response.parts, 7);
      strictEqual(response.contentLength, 17168732);
      strictEqual(response.status, '1');
      strictEqual(response.owner, 'v@makeomatic.ru');
      strictEqual(response.bucket.startsWith('makeomatic-13123'), true);
      strictEqual(response.uploadType, 'pano-cubemap');

      strictEqual(response.files[0].contentType, 'image/jpeg');
      strictEqual(response.files[0].contentLength, 2452676);
      strictEqual(response.files[0].md5Hash !== undefined, true);
      strictEqual(response.files[0].bucket.startsWith('makeomatic-13123'), true);
      strictEqual(response.files[0].type, 'c-preview');
      strictEqual(response.files[0].filename !== undefined, true);
      strictEqual(response.files[0].location !== undefined, true);

      strictEqual(response.files[1].contentType, 'image/jpeg');
      strictEqual(response.files[1].contentLength, 2452676);
      strictEqual(response.files[1].md5Hash !== undefined, true);
      strictEqual(response.files[1].bucket.startsWith('makeomatic-13123'), true);
      strictEqual(response.files[1].type, 'pano-cubemap-image');
      strictEqual(response.files[1].filename !== undefined, true);
      strictEqual(response.files[1].location !== undefined, true);

      strictEqual(response.files[2].contentType, 'image/jpeg');
      strictEqual(response.files[2].contentLength, 2452676);
      strictEqual(response.files[2].md5Hash !== undefined, true);
      strictEqual(response.files[2].bucket.startsWith('makeomatic-13123'), true);
      strictEqual(response.files[2].type, 'pano-cubemap-image');
      strictEqual(response.files[2].filename !== undefined, true);
      strictEqual(response.files[2].location !== undefined, true);

      strictEqual(response.files[3].contentType, 'image/jpeg');
      strictEqual(response.files[3].contentLength, 2452676);
      strictEqual(response.files[3].md5Hash !== undefined, true);
      strictEqual(response.files[3].bucket.startsWith('makeomatic-13123'), true);
      strictEqual(response.files[3].type, 'pano-cubemap-image');
      strictEqual(response.files[3].filename !== undefined, true);
      strictEqual(response.files[3].location !== undefined, true);

      strictEqual(response.files[4].contentType, 'image/jpeg');
      strictEqual(response.files[4].contentLength, 2452676);
      strictEqual(response.files[4].md5Hash !== undefined, true);
      strictEqual(response.files[4].bucket.startsWith('makeomatic-13123'), true);
      strictEqual(response.files[4].type, 'pano-cubemap-image');
      strictEqual(response.files[4].filename !== undefined, true);
      strictEqual(response.files[4].location !== undefined, true);

      strictEqual(response.files[5].contentType, 'image/jpeg');
      strictEqual(response.files[5].contentLength, 2452676);
      strictEqual(response.files[5].md5Hash !== undefined, true);
      strictEqual(response.files[5].bucket.startsWith('makeomatic-13123'), true);
      strictEqual(response.files[5].type, 'pano-cubemap-image');
      strictEqual(response.files[5].filename !== undefined, true);
      strictEqual(response.files[5].location !== undefined, true);

      strictEqual(response.files[6].contentType, 'image/jpeg');
      strictEqual(response.files[6].contentLength, 2452676);
      strictEqual(response.files[6].md5Hash !== undefined, true);
      strictEqual(response.files[6].bucket.startsWith('makeomatic-13123'), true);
      strictEqual(response.files[6].type, 'pano-cubemap-image');
      strictEqual(response.files[6].filename !== undefined, true);
      strictEqual(response.files[6].location !== undefined, true);

      strictEqual(response.files[7] === undefined, true);
    });

    it('should be able to return an error if the file type is invalid', async () => {
      const { amqp } = this.ctx;

      await rejects(amqp.publishAndWait('files.upload', {
        username: 'v@makeomatic.ru',
        uploadType: 'pano-cubemap',
        meta: {
          name: 'pano-cubemap exmaple',
        },
        files: [{
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'c-preview',
        }, {
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'pano-equirect-image', // invalid type
        }],
      }), 'HttpStatusError: upload validation failed: data.files[0].type should be equal to constant');
    });

    it('should be able to return an error if the number of files is invalid', async () => {
      const { amqp } = this.ctx;

      await rejects(amqp.publishAndWait('files.upload', {
        username: 'v@makeomatic.ru',
        uploadType: 'pano-cubemap',
        meta: {
          name: 'pano-cubemap exmaple',
        },
        files: [{ // invalid count
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'c-preview',
        }, {
          contentType: 'image/jpeg',
          contentLength: 2452676,
          md5Hash: '8478d2bdfc72bea50f2754615d8b357b',
          type: 'pano-cubemap-image',
        }],
      }), 'HttpStatusError: upload validation failed: data.files should NOT have more than 1 items');
    });
  });
});
