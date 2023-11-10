const assert = require('assert');
const uuid = require('uuid');

describe('access suite', function suite() {
  // helpers
  const {
    startService,
    stopService,
    owner,
    modelData,
    bindSend,
    initAndUpload,
    processUpload,
    updateAccess,
    downloadFile,
  } = require('../helpers/utils');

  const route = 'files.access';

  // setup functions
  before('start service', startService);

  // sets `this.response` to `files.finish` response
  before('pre-upload file', initAndUpload(modelData));
  before('pre-process file', function preprocess() {
    return processUpload.call(this, this.response);
  });
  before('helpers', bindSend(route));

  // tear-down
  after('stop service', stopService);

  // tests
  it('returns 404 on a missing file', async function test() {
    await assert.rejects(updateAccess.call(this, uuid.v4(), owner, true), {
      statusCode: 404,
    });
  });

  it('returns 403 on non-matching owner', async function test() {
    await assert.rejects(updateAccess.call(this, this.response.uploadId, 'martial@arts.com', true), {
      statusCode: 403,
    });
  });

  it('sets file to public', function test() {
    return updateAccess
      .call(this, this.response.uploadId, owner, true);
  });

  it('sets file to private', function test() {
    return updateAccess
      .call(this, this.response.uploadId, owner, false);
  });

  describe('direct upload', function directUploadSuite() {
    before('pre-upload file', initAndUpload({
      ...modelData,
      message: {
        ...modelData.message,
        directOnly: true,
        access: {
          setPublic: false,
        },
      },
    }));

    it('post-processes files', function test() {
      return this.files.postProcess(0, Date.now());
    });

    it('rejects to show direct only file without proper username', async function test() {
      await assert.rejects(downloadFile.call(this, { uploadId: this.response.uploadId }));
    });

    it('set to public', function test() {
      return updateAccess
        .call(this, this.response.uploadId, owner, true);
    });

    it('allows to show direct only file without proper username', function test() {
      return downloadFile
        .call(this, { uploadId: this.response.uploadId });
    });

    it('public list does not return direct only file', async function test() {
      const { files } = await this
        .amqp
        .publishAndWait('files.list', {
          public: true,
          username: owner,
        });

      const directUpload = files.find((it) => it.id === this.response.uploadId);
      assert.ifError(directUpload, 'direct upload was returned from public list');
    });
  });

  describe('references', function referenceCheckSuite() {
    const uploadIds = [];
    let uploadId;
    before('upload files', async function uploadFile() {
      for (let i = 0; i < 2; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const uploaded = await initAndUpload({
          ...modelData,
          message: {
            ...modelData.message,
            access: {
              setPublic: true,
            },
          },
        }, false).call({ amqp: this.amqp });

        uploadIds.push(uploaded.uploadId);
      }

      const parentUpload = await initAndUpload({
        ...modelData,
        message: {
          ...modelData.message,
          meta: {
            ...modelData.message.meta,
            references: uploadIds,
          },
          access: {
            setPublic: true,
          },
        },
      }, false).call({ amqp: this.amqp });
      uploadId = parentUpload.uploadId;
    });

    it('disallows access change for upload with references', async function test() {
      await assert.rejects(updateAccess.call(this, uploadId, owner, false), /should not have or be a reference/);
      await assert.rejects(updateAccess.call(this, uploadId, owner, true), /should not have or be a reference/);
    });

    it('disallows access change for referenced upload', async function test() {
      await assert.rejects(updateAccess.call(this, uploadIds[0], owner, false), /should not have or be a reference/);
      await assert.rejects(updateAccess.call(this, uploadIds[1], owner, true), /should not have or be a reference/);
    });
  });
});
