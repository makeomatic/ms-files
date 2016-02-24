/* global inspectPromise, SAMPLE_FILE */
const request = require('request-promise');
const assert = require('assert');
const md5 = require('md5');
const { STATUS_PENDING } = require('../../src/constant.js');

describe('upload suite', function suite() {
  before(global.startService);
  after(global.clearService);

  const bucketName = process.env.GCLOUD_PROJECT_BUCKET;
  // https://www.googleapis.com/upload/storage/v1/b/bucketName/o?name=test%40owner.com%2F5b8cafc2-6f40-4931-8fee-430f68577489&uploadType=resumable&upload_id=AEnB2UoBS-BRUICRQrY-Bd4MC8Twczkrye0cK3hadYQzALNPR1EvGR9tLaj43fcjVmkHcxSErInzdLK0qahK92hU9PwiqA07oA
  const locPattern = new RegExp(`^https:\\/\\/www\\.googleapis\\.com\/upload\\/storage\\/v1\\/b\\/${bucketName}\\/o\\?name=.+\\&uploadType=resumable\\&upload_id=.+`); // eslint-disable-line

  it('verifies input data and rejects on invalid format', function test() {
    return this.amqp.publishAndWait('files.upload', {
      contentType: 123,
      md5Hash: 'veryrandom',
      contentLength: -100,
      id: 'super-owner@qq.com',
      name: 'my-good-file',
    })
    .reflect()
    .then(inspectPromise(false))
    .then(error => {
      assert(error.name, 'ValidationError');
    });
  });

  it('initiates upload', function test() {
    const msg = {
      id: 'test@owner.com',
      contentType: SAMPLE_FILE.contentType,
      contentLength: SAMPLE_FILE.contentLength,
      name: SAMPLE_FILE.name,
      md5Hash: SAMPLE_FILE.md5,
    };

    return this.amqp.publishAndWait('files.upload', msg)
    .reflect()
    .then(inspectPromise())
    .tap(data => {
      assert.ok(data.uploadId);
      assert.ok(
        locPattern.test(data.location),
        `returned invalid gcloud location: ${data.location}`
      );
      assert(data.filename.indexOf(`${md5(msg.id)}/`) === 0, 'prepended owner of the file to id');
      assert(data.startedAt);
      assert.equal(data.status, STATUS_PENDING);
      assert.equal(data.humanName, msg.name);
      assert.equal(data.contentType, msg.contentType);
      assert.equal(data.contentLength, msg.contentLength);
      assert.equal(data.owner, msg.id);
      assert.equal(data.md5Hash, msg.md5Hash);
    })
    .then(data => {
      this.location = data.location;
      this.uploadId = data.uploadId;
    });
  });

  it('able to upload with the provided response', function test() {
    return request.put({
      url: this.location,
      body: SAMPLE_FILE.contents,
      headers: {
        'content-length': SAMPLE_FILE.contentLength,
      },
      simple: false,
      resolveWithFullResponse: true,
    })
    .then(response => {
      assert.equal(response.statusCode, 200);
    });
  });
});
