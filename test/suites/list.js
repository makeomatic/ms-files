const Promise = require('bluebird');
const assert = require('assert');
const faker = require('faker');
const ld = require('lodash');
const uuid = require('node-uuid');

// helpers
const {
  startService,
  stopService,
  inspectPromise,
  bindSend,
  initAndUpload,
  processUpload,
  modelData,
  meta,
  owner: username,
} = require('../helpers/utils.js');

const route = 'files.list';
const updateRoute = 'files.update';
const {
  STATUS_UPLOADED, STATUS_PROCESSED,
  FILES_DATA, FILES_INDEX, FILES_INDEX_PUBLIC,
  FILES_OWNER_FIELD, FILES_PUBLIC_FIELD,
} = require('../../src/constant.js');

describe('list suite', function suite() {
  // setup functions
  before('start service', startService);
  before('pre-upload file', initAndUpload(modelData));
  before('helpers', bindSend(route));

  // tear-down
  after('stop service', stopService);

  // helper to create fake file
  const statusValues = [STATUS_UPLOADED, STATUS_PROCESSED];
  const owners = ld.times(5, faker.internet.email);
  owners.push(username); // for some intersection with updated file

  function createFakeFile() {
    const owner = ld.sample(owners);
    const startedAt = faker.date.past().getTime();

    return {
      uploadId: uuid.v4(),
      status: ld.sample(statusValues),
      startedAt,
      uploadedAt: startedAt + 1000,
      name: faker.commerce.productName(),
      files: JSON.stringify([]), // can insert real files, but dont care
      contentLength: ld.random(1, 2132311),
      parts: ld.random(1, 4),
      [FILES_OWNER_FIELD]: owner,
    };
  }

  function insertFile(file) {
    const id = file.uploadId;
    const pipeline = this
      .files
      .redis
      .pipeline()
      .sadd(FILES_INDEX, id)
      .sadd(`${FILES_INDEX}:${file.owner}`, id);

    if (ld.sample([0, 1]) === 1 && file.status === STATUS_PROCESSED) {
      file[FILES_PUBLIC_FIELD] = 1;
      pipeline.sadd(FILES_INDEX_PUBLIC, id);
      pipeline.sadd(`${FILES_INDEX}:${file.owner}:pub`, id);
    }

    pipeline.hmset(`${FILES_DATA}:${id}`, file);

    return pipeline.exec();
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

  const ascSortFilename = sort(1, 'alphanum', 'id');
  const descSortFilename = sort(-1, 'alphanum', 'id');
  const ascSortStartAt = sort(1, 'numeric', 'startedAt');
  const descSortStartAt = sort(-1, 'numeric', 'startedAt');

  before('insert data', function test() {
    return Promise.all(ld.times(500, () => insertFile.call(this, createFakeFile())));
  });

  describe('owner-based list', function testSuite() {
    const owner = ld.sample(owners);

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

          if (file.status === STATUS_PROCESSED) {
            assert.ok(file.embed);
            assert.ok(file.embed.code);
            assert.equal(typeof file.embed.code, 'string');
            assert.notEqual(file.embed.code.length, 0);
            assert.ok(file.embed.params);

            Object.keys(file.embed.params).forEach(key => {
              const param = file.embed.params[key];
              assert.ok(param.type);
              assert.notStrictEqual(param.default, undefined);
              assert.ok(param.description);
            });
          } else {
            assert.equal(file.embed, undefined);
          }
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
    const owner = ld.sample(owners);

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

    it('lists public files', function test() {
      return this.amqp.publishAndWait('files.list', {
        public: true,
        order: 'DESC',
        limit: 10,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);
        descSortFilename(data.files);
        assert.equal(data.cursor, 10);
        assert.equal(data.page, 1);
        assert.ok(data.pages);

        data.files.forEach(file => {
          assert.equal(file.public, 1);
        });
      });
    });

    it('lists public files with a specific owner', function test() {
      return this.amqp.publishAndWait('files.list', {
        owner,
        public: true,
        order: 'DESC',
        limit: 10,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);
        descSortFilename(data.files);
        assert.equal(data.cursor, 10);
        assert.equal(data.page, 1);
        assert.ok(data.pages);

        data.files.forEach(file => {
          assert.equal(file.owner, owner);
        });
      });
    });
  });

  describe('tags-based list', function testSuite() {
    before('upload', function pretest() {
      return processUpload.call(this, this.response);
    });

    before('update', function pretest() {
      return this.amqp.publishAndWait(updateRoute, {
        uploadId: this.response.uploadId,
        username,
        meta,
      });
    });

    it('returns files sorted by their tags', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {},
        tags: meta.tags,
        order: 'ASC',
        offset: 0,
        limit: 10,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);
        assert.equal(data.cursor, 10);
        assert.equal(data.page, 1);
        assert.ok(data.pages);

        data.files.forEach(file => {
          assert.equal(file.owner, username);
          assert.deepEqual(file.tags, meta.tags);
        });
      });
    });

    it('returns files sorted by their filename and tags', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {},
        tags: meta.tags,
        owner: username,
        order: 'ASC',
        offset: 0,
        limit: 10,
      })
      .reflect()
      .then(inspectPromise())
      .then(data => {
        assert.ok(data.files);

        data.files.forEach(file => {
          assert.equal(file.owner, username);
          assert.deepEqual(file.tags, meta.tags);
        });
      });
    });
  });
});
