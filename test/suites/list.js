/* global inspectPromise, SAMPLE_FILE, UPLOAD_MESSAGE, uploadToGoogle */

const Promise = require('bluebird');
const assert = require('assert');
const faker = require('faker');
const ld = require('lodash');
const uuid = require('node-uuid');
const md5 = require('md5');

describe('list suite', function suite() {
  before(global.startService);
  after(global.clearService);

  const { STATUS_PENDING, STATUS_UPLOADED, STATUS_PROCESSED } = require('../../src/constant.js');
  const statusValues = [STATUS_PENDING, STATUS_UPLOADED, STATUS_PROCESSED];
  const owners = ld.times(5, faker.internet.email);
  const contentTypes = ['text/plain', 'image/png', 'application/json'];

  function createFakeFile() {
    const contents = faker.commerce.productName();
    const owner = ld.sample(owners, 1)[0];

    return {
      filename: [owner, uuid.v4()].join('/'),
      uploadId: uuid.v4(),
      status: ld.sample(statusValues, 1)[0],
      location: faker.internet.url(),
      startedAt: faker.date.past().getTime(),
      humanName: contents,
      md5Hash: md5(contents),
      contentType: ld.sample(contentTypes, 1)[0],
      contentLength: Buffer.byteLength(contents),
      owner,
    };
  }

  function insertUpload(file) {
    return this.files.redis.hmset(`upload-data:${file.uploadId}`, file);
  }

  function insertFile(file) {
    return this.files.redis.pipeline()
      .sadd('files-index', file.filename)
      .sadd(`files-index:${file.owner}`, file.filename)
      .hmset(`files-data:${file.filename}`, file)
      .exec();
  }

  function alphanumSort(direction, field) {
    return (a, b) => {
      const FA = a[field];
      const FB = b[field];
      return direction * FA.localeCompare(FB);
    };
  }

  function numericSort(direction, field) {
    return (a, b) => {
      const FA = a[field];
      const FB = b[field];
      return direction * (FA - FB);
    };
  }

  // direction: 1 ASC, -1 DESC
  // type: alphanum, numeric
  // field: to use for sorting
  function sort(direction, type, field) {
    return data => {
      const copy = [].concat(data);
      copy.sort((type === 'alphanum' ? alphanumSort : numericSort)(direction, field));
      assert.deepEqual(data, copy);
    };
  }

  const ascSortFilename = sort(1, 'alphanum', 'filename');
  const descSortFilename = sort(-1, 'alphanum', 'filename');
  const ascSortStartAt = sort(1, 'numeric', 'startedAt');
  const descSortStartAt = sort(-1, 'numeric', 'startedAt');

  before('insert data', function test() {
    return Promise.all(ld.times(500, () => {
      const file = createFakeFile();
      const thunk = file.status === STATUS_PENDING ? insertUpload : insertFile;
      return thunk.call(this, file);
    }));
  });

  describe('owner-based list', function testSuite() {
    const owner = ld.sample(owners, 1)[0];

    it('returns files sorted by their filename, ASC', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {},
        owner,
        order: 'ASC',
        offset: 30,
        limit: 10,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);
        ascSortFilename(data.files);
        assert.equal(data.cursor, 40);
        assert.equal(data.page, 4);
        assert.ok(data.pages);

        data.files.forEach(file => {
          assert.equal(file.owner, owner);
        });
      });
    });

    it('returns files sorted by their filename, DESC', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {},
        owner,
        order: 'DESC',
        offset: 30,
        limit: 10,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);
        descSortFilename(data.files);
        assert.equal(data.cursor, 40);
        assert.equal(data.page, 4);
        assert.ok(data.pages);

        data.files.forEach(file => {
          assert.equal(file.owner, owner);
        });
      });
    });

    it('returns files sorted by their startedAt, ASC', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {},
        owner,
        order: 'ASC',
        offset: 30,
        limit: 10,
        criteria: 'startedAt',
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);
        ascSortStartAt(data.files);
        assert.equal(data.cursor, 40);
        assert.equal(data.page, 4);
        assert.ok(data.pages);

        data.files.forEach(file => {
          assert.equal(file.owner, owner);
        });
      });
    });

    it('returns files sorted by their startedAt, DESC', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {},
        owner,
        order: 'DESC',
        offset: 30,
        limit: 10,
        criteria: 'startedAt',
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);
        descSortStartAt(data.files);
        assert.equal(data.cursor, 40);
        assert.equal(data.page, 4);
        assert.ok(data.pages);

        data.files.forEach(file => {
          assert.equal(file.owner, owner);
        });
      });
    });

    it('returns files sorted by their filename, filtered by size, ASC', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {
          contentLength: {
            gte: 5,
          },
        },
        owner,
        order: 'ASC',
        offset: 30,
        limit: 10,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);
        ascSortFilename(data.files);
        assert.equal(data.cursor, 40);
        assert.equal(data.page, 4);
        assert.ok(data.pages);

        data.files.forEach(file => {
          assert.equal(file.owner, owner);
          assert.ok(file.contentLength >= 5, 'gte filter failed');
        });
      });
    });

    it('returns files sorted by their filename, filtered by size, DESC', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {
          contentLength: {
            gte: 5,
          },
        },
        owner,
        order: 'DESC',
        offset: 30,
        limit: 10,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);
        descSortFilename(data.files);
        assert.equal(data.cursor, 40);
        assert.equal(data.page, 4);
        assert.ok(data.pages);

        data.files.forEach(file => {
          assert.equal(file.owner, owner);
          assert.ok(file.contentLength >= 5, 'gte filter failed');
        });
      });
    });
  });

  describe('generic file list', function testSuite() {
    const owner = ld.sample(owners, 1)[0];

    it('returns files sorted by their filename, ASC', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {},
        order: 'ASC',
        offset: 30,
        limit: 10,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);
        ascSortFilename(data.files);
        assert.equal(data.cursor, 40);
        assert.equal(data.page, 4);
        assert.ok(data.pages);
      });
    });

    it('returns files sorted by their filename, DESC', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {},
        order: 'DESC',
        offset: 30,
        limit: 10,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);
        descSortFilename(data.files);
        assert.equal(data.cursor, 40);
        assert.equal(data.page, 4);
        assert.ok(data.pages);
      });
    });

    it('returns files sorted by their startedAt, ASC', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {},
        order: 'ASC',
        offset: 30,
        limit: 10,
        criteria: 'startedAt',
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);
        ascSortStartAt(data.files);
        assert.equal(data.cursor, 40);
        assert.equal(data.page, 4);
        assert.ok(data.pages);
      });
    });

    it('returns files sorted by their startedAt, DESC', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {},
        order: 'DESC',
        offset: 30,
        limit: 10,
        criteria: 'startedAt',
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);
        descSortStartAt(data.files);
        assert.equal(data.cursor, 40);
        assert.equal(data.page, 4);
        assert.ok(data.pages);
      });
    });

    it('returns files sorted by their filename, filtered by owner, ASC', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {
          owner: {
            eq: owner,
          },
        },
        order: 'ASC',
        offset: 30,
        limit: 10,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);
        ascSortFilename(data.files);
        assert.equal(data.cursor, 40);
        assert.equal(data.page, 4);
        assert.ok(data.pages);

        data.files.forEach(file => {
          assert.equal(file.owner, owner);
        });
      });
    });

    it('returns files sorted by their filename, filtered by owner, DESC', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {
          owner: {
            eq: owner,
          },
        },
        order: 'DESC',
        offset: 30,
        limit: 10,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);
        descSortFilename(data.files);
        assert.equal(data.cursor, 40);
        assert.equal(data.page, 4);
        assert.ok(data.pages);

        data.files.forEach(file => {
          assert.equal(file.owner, owner);
        });
      });
    });
  });
});
