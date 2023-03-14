const assert = require('assert');
const { faker } = require('@faker-js/faker');
const ld = require('lodash');
const moment = require('moment');
const { rejects } = require('assert');

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
const { insertData, skus, ids } = require('../helpers/insert-data');

const route = 'files.list';
const updateRoute = 'files.update';
const {
  STATUS_UPLOADED,
  STATUS_PROCESSED,
  FILES_UPLOADED_AT_FIELD,
} = require('../../src/constant');

for (const redisSearchEnabled of [true, false].values()) {
  describe(`list suite, redisSearchEnabled: ${redisSearchEnabled}`, function suite() {
    // setup functions
    before('override config', function overrideConfig() {
      this.configOverride = {
        redisSearch: {
          enabled: redisSearchEnabled,
        },
        migrations: {
          enabled: true,
        },
      };
    });
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
      // we upload an extra file later
      skus.clear();
      ids.clear();
      return insertData.call(this, { times: 499, owners, statuses: statusValues });
    });

    describe('multi-field search, name search', function testSuite() {
      it('returns files filtered by their SKU', async function test() {
        const sku = ld.sample(Array.from(skus));
        const data = await this.amqp.publishAndWait('files.list', {
          filter: {
            '#multi': {
              fields: [
                'name',
                'description',
                'website',
                'owner',
                'alias',
              ],
              match: sku,
            },
          },
          order: 'DESC',
        });

        assert.ok(data.files);
        descSortFilename(data.files);
        assert.equal(data.cursor, 10);
        assert.equal(data.page, 1);
        assert.ok(data.pages);

        data.files.forEach((file) => {
          if (file.status === STATUS_PROCESSED) {
            assert.ok(file.embed);
            assert.ok(file.embed.code);
            assert.equal(typeof file.embed.code, 'string');
            assert.notEqual(file.embed.code.length, 0);
            assert.ok(file.embed.params);

            assert([file.alias, file.name, file.description, file.website, file.owner].some((datum) => {
              return datum.toLowerCase().includes(sku.toLowerCase());
            }), `cant find ${sku} in ${JSON.stringify(file)}`);

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

      it('returns files filtered by their id', async function test() {
        const id = ld.sample(Array.from(ids));
        const data = await this.amqp.publishAndWait('files.list', {
          filter: { '#': id },
          order: 'DESC',
        });

        assert.ok(data.files);
        descSortFilename(data.files);
        assert.equal(data.cursor, 10);
        assert.equal(data.page, 1);
        assert.ok(data.pages);

        data.files.forEach((file) => {
          if (file.status === STATUS_PROCESSED) {
            assert.ok(file.embed);
            assert.ok(file.embed.code);
            assert.equal(typeof file.embed.code, 'string');
            assert.notEqual(file.embed.code.length, 0);
            assert.ok(file.embed.params);

            assert(file.uploadId.includes(id), `cant find ${id} in ${file.uploadId}`);

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
      [{ gte: monthAgo.valueOf(), lte: dayAgo.valueOf() }, [['isSameOrAfter', monthAgo], ['isSameOrBefore', dayAgo]]],
      [{ gte: monthAgo.clone().add(1, 'day').valueOf(), lte: dayAgo.valueOf() }, [['isSameOrBefore', dayAgo]]],
    ];

    const errors = [
      {},
      { gte: moment().subtract(32, 'days').valueOf() }, // 32 days
      { lte: dayAgo.valueOf() }, // -inf -> lte
      { gte: monthAgo.clone().subtract(1, 'month').valueOf(), lte: dayAgo.valueOf() }, // 2 months - 1 day
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
                assert(moment(+file[FILES_UPLOADED_AT_FIELD])[fn](compare), `${compare} ${fn} ${moment(+file[FILES_UPLOADED_AT_FIELD])}`);
              }
            });
          });
        }

        if (!redisSearchEnabled) {
          for (const uploadedAt of errors.values()) {
            it(`(${order}) errors out due to invalid interval: ${JSON.stringify(uploadedAt)}`, async function test() {
              await assert.rejects(this.amqp.publishAndWait('files.list', {
                filter: { uploadedAt },
                owner: username,
                order,
                offset: 0,
                limit: 10,
              }));
            });
          }
        }
      }
    });

    describe('tags-based list', function testSuite() {
      before('upload', async function pretest() {
        await processUpload.call(this, this.response);

        const tags = [...meta.tags];
        tags[1] = 'tagMew';

        // this file should not be returned by search as tag search is using `AND`
        return this.amqp.publishAndWait(updateRoute, {
          uploadId: this.response.uploadId,
          username,
          meta: {
            ...meta,
            tags,
          },
        });
      });

      before('pre-upload file #2', async function pretest() {
        const { uploadId } = await initAndUpload(modelData, false).call(this);

        // this file should not be returned by search as tag search is using `AND`
        return this.amqp.publishAndWait(updateRoute, {
          uploadId,
          username,
          meta,
        });
      });

      it('returns files filtered by their tags', function test() {
        return this.amqp.publishAndWait('files.list', {
          filter: {},
          tags: meta.tags,
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
            assert.equal(data.files.length, 1);
            assert.equal(data.cursor, 10);
            assert.equal(data.page, 1);
            assert.ok(data.pages);
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
      describe('generic', function suiteGeneric() {
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

        if (!redisSearchEnabled) {
          it('throws not implemented on nft modeltype request', async function test() {
            const promise = this.amqp.publishAndWait('files.list', {
              filter: {},
              order: 'ASC',
              offset: 0,
              limit: 10,
              modelType: 'nft',
            });

            await rejects(promise, /nft filter is unavailable/);
          });

          return;
        }

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

        it('returns files for modelType nft and owner without wallet', async function test() {
          const list = await this.amqp.publishAndWait('files.list', {
            filter: {},
            order: 'ASC',
            offset: 0,
            limit: 10,
            modelType: 'nft',
            owner: username,
          });

          assert.equal(list.pages, 1);
        });
      });

      describe('model with nftOwner', function suiteNft() {
        // fsort logic not implemented
        if (!redisSearchEnabled) {
          return;
        }

        before(async function before() {
          await this.amqp.publishAndWait(updateRoute, {
            uploadId: this.response.uploadId,
            username,
            meta: {
              nftOwner: '0x0000000000000000000000000000000000000000',
            },
          });
        });

        it('returns files for modelType nft and wallet', async function test() {
          const list = await this.amqp.publishAndWait('files.list', {
            filter: {},
            order: 'ASC',
            offset: 0,
            limit: 10,
            modelType: 'nft',
            nftOwner: '0x0000000000000000000000000000000000000000',
          });

          assert.equal(list.pages, 1);
        });

        it('shows files for modelType nft by username and wallet', async function test() {
          const list = await this.amqp.publishAndWait('files.list', {
            filter: {},
            order: 'ASC',
            offset: 0,
            limit: 10,
            modelType: 'nft',
            owner: username,
            nftOwner: '0x0000000000000000000000000000000000000000',
          });

          assert.equal(list.pages, 1);
        });

        it('shows files for modelType nft by different username and matching wallet', async function test() {
          const list = await this.amqp.publishAndWait('files.list', {
            filter: {},
            order: 'ASC',
            offset: 0,
            limit: 10,
            modelType: 'nft',
            owner: `${username}123`,
            nftOwner: '0x0000000000000000000000000000000000000000',
          });

          assert.equal(list.pages, 1);
        });

        it('hides files for modelType nft by different username and matching wallet', async function test() {
          const list = await this.amqp.publishAndWait('files.list', {
            filter: {},
            order: 'ASC',
            offset: 0,
            limit: 10,
            modelType: 'nft',
            owner: username,
            nftOwner: '0x0000000000000000000000000000000000000003',
          });

          assert.equal(list.pages, 0);
        });
      });
    });
  });
}
