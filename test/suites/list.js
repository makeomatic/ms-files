const assert = require('assert');
const faker = require('faker');
const ld = require('lodash');
const moment = require('moment');

// helpers
const {
  startService,
  stopService,
  bindSend,
  initAndUpload,
  processUpload,
  modelData,
  meta,
  nftMeta,
  owner: username,
} = require('../helpers/utils');
const { insertData } = require('../helpers/insert-data');

const route = 'files.list';
const updateRoute = 'files.update';
const {
  STATUS_UPLOADED,
  STATUS_PROCESSED,
  FILES_UPLOADED_AT_FIELD,
} = require('../../src/constant');

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
    return (data) => {
      const copy = [].concat(data);
      copy.sort((type === 'alphanum' ? alphanumSort : numericSort)(direction, field));
      assert.deepEqual(data, copy);
    };
  }

  const ascSortFilename = sort(1, 'alphanum', 'id');
  const descSortFilename = sort(-1, 'alphanum', 'id');
  const ascSortStartAt = sort(1, 'numeric', 'startedAt');
  const descSortStartAt = sort(-1, 'numeric', 'startedAt');

  before('insert data', function insertFiles() {
    return insertData.call(this, { times: 500, owners, statuses: statusValues });
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
        .then((data) => {
          assert.ok(data.files);
          ascSortFilename(data.files);
          assert.equal(data.cursor, 40);
          assert.equal(data.page, 4);
          assert.ok(data.pages);

          data.files.forEach((file) => {
            assert.equal(file.owner, owner);

            if (file.status === STATUS_PROCESSED) {
              assert.ok(file.embed);
              assert.ok(file.embed.code);
              assert.equal(typeof file.embed.code, 'string');
              assert.notEqual(file.embed.code.length, 0);
              assert.ok(file.embed.params);

              Object.keys(file.embed.params).forEach((key) => {
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
        .then((data) => {
          assert.ok(data.files);
          descSortFilename(data.files);
          assert.equal(data.cursor, 40);
          assert.equal(data.page, 4);
          assert.ok(data.pages);

          data.files.forEach((file) => {
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
        .then((data) => {
          assert.ok(data.files);
          ascSortStartAt(data.files);
          assert.equal(data.cursor, 40);
          assert.equal(data.page, 4);
          assert.ok(data.pages);

          data.files.forEach((file) => {
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
        .then((data) => {
          assert.ok(data.files);
          descSortStartAt(data.files);
          assert.equal(data.cursor, 40);
          assert.equal(data.page, 4);
          assert.ok(data.pages);

          data.files.forEach((file) => {
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
        .then((data) => {
          assert.ok(data.files);
          ascSortFilename(data.files);
          assert.equal(data.cursor, 40);
          assert.equal(data.page, 4);
          assert.ok(data.pages);

          data.files.forEach((file) => {
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
        .then((data) => {
          assert.ok(data.files);
          descSortFilename(data.files);
          assert.equal(data.cursor, 40);
          assert.equal(data.page, 4);
          assert.ok(data.pages);

          data.files.forEach((file) => {
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
        .then((data) => {
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
        .then((data) => {
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
        .then((data) => {
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
        .then((data) => {
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
        .then((data) => {
          assert.ok(data.files);
          ascSortFilename(data.files);
          assert.equal(data.cursor, 40);
          assert.equal(data.page, 4);
          assert.ok(data.pages);

          data.files.forEach((file) => {
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
        .then((data) => {
          assert.ok(data.files);
          descSortFilename(data.files);
          assert.equal(data.cursor, 40);
          assert.equal(data.page, 4);
          assert.ok(data.pages);

          data.files.forEach((file) => {
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
        .then((data) => {
          assert.ok(data.files);
          descSortFilename(data.files);
          assert.equal(data.cursor, 10);
          assert.equal(data.page, 1);
          assert.ok(data.pages);

          data.files.forEach((file) => {
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
        .then((data) => {
          assert.ok(data.files);
          descSortFilename(data.files);
          assert.equal(data.cursor, 10);
          assert.equal(data.page, 1);
          assert.ok(data.pages);

          data.files.forEach((file) => {
            assert.equal(file.owner, owner);
          });
        });
    });
  });

  const monthAgo = moment().subtract(1, 'month');
  const dayAgo = moment().subtract(1, 'day');

  const cases = [
    [{ gte: monthAgo.valueOf() }, [['isSameOrAfter', monthAgo]]],
    [{ lte: dayAgo.valueOf() }, [['isSameOrBefore', dayAgo]]],
    [{ gte: monthAgo.valueOf(), lte: dayAgo.valueOf() }, [['isSameOrAfter', monthAgo], ['isSameOrBefore', dayAgo]]],
  ];

  describe('use of uploadedAt index', function testSuite() {
    for (const order of ['ASC', 'DESC'].values()) {
      for (const [uploadedAt, verification] of cases.values()) {
        it(`(${order}) returns files sorted by their filename: ${JSON.stringify(uploadedAt)}`, async function test() {
          const data = await this.amqp.publishAndWait('files.list', {
            filter: { uploadedAt },
            owner: username,
            order,
            offset: 0,
            limit: 10,
          });

          assert.ok(data.files);

          data.files.forEach((file) => {
            assert.equal(file.owner, username);
            for (const [fn, compare] of verification.values()) {
              assert(moment(+file[FILES_UPLOADED_AT_FIELD])[fn](compare));
            }
          });
        });
      }
    }
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
        .then((data) => {
          assert.ok(data.files);
          assert.equal(data.cursor, 10);
          assert.equal(data.page, 1);
          assert.ok(data.pages);

          data.files.forEach((file) => {
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
        .then((data) => {
          assert.ok(data.files);

          data.files.forEach((file) => {
            assert.equal(file.owner, username);
            assert.deepEqual(file.tags, meta.tags);
          });
        });
    });

    describe('(tags) use uploadedAt index', function tests() {
      for (const order of ['ASC', 'DESC'].values()) {
        for (const [uploadedAt, verification] of cases.values()) {
          it(`(${order}) returns files sorted by their filename and tags: ${JSON.stringify(uploadedAt)}`, async function test() {
            const data = await this.amqp.publishAndWait('files.list', {
              filter: { uploadedAt },
              tags: meta.tags,
              owner: username,
              order,
              offset: 0,
              limit: 10,
            });

            assert.ok(data.files);

            data.files.forEach((file) => {
              assert.equal(file.owner, username);
              assert.deepEqual(file.tags, meta.tags);
              for (const [fn, compare] of verification.values()) {
                assert(moment(+file[FILES_UPLOADED_AT_FIELD])[fn](compare));
              }
            });
          });
        }
      }
    });
  });

  describe('use modelType filter for files with nft meta', function testSuite() {
    before('update', function pretest() {
      return this.amqp.publishAndWait(updateRoute, {
        uploadId: this.response.uploadId,
        username,
        meta: nftMeta,
      });
    });

    it('returns files without modelType meta', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {},
        order: 'ASC',
        offset: 0,
        limit: 10,
      })
        .then((data) => {
          assert.equal(data.pages, 51);
        });
    });

    it('returns files for 3d', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {},
        order: 'ASC',
        offset: 0,
        limit: 10,
        modelType: '3d',
      })
        .then((data) => {
          assert.equal(data.pages, 50);
        });
    });

    it('returns files for modelType nft', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {},
        order: 'ASC',
        offset: 0,
        limit: 10,
        modelType: 'nft',
      })
        .then((data) => {
          assert.equal(data.pages, 1);
        });
    });

    it('returns no files for modelType void', function test() {
      return this.amqp.publishAndWait('files.list', {
        filter: {},
        order: 'ASC',
        offset: 0,
        limit: 10,
        modelType: 'void',
      })
        .then((data) => {
          assert.equal(data.pages, 0);
        });
    });
  });
});
