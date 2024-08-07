const ld = require('lodash');
const Promise = require('bluebird');
const { faker } = require('@faker-js/faker');
const uuid = require('uuid');
const {
  FILES_ALIAS_FIELD,
  FILES_CONTENT_LENGTH_FIELD,
  FILES_DATA,
  FILES_DESCRIPTION_FIELD,
  FILES_ID_FIELD,
  FILES_INDEX_PUBLIC,
  FILES_INDEX_UAT_PUBLIC,
  FILES_INDEX_UAT,
  FILES_INDEX,
  FILES_NAME_FIELD,
  FILES_NAME_NORMALIZED_FIELD,
  FILES_OWNER_FIELD,
  FILES_PUBLIC_FIELD,
  FILES_UPLOAD_STARTED_AT_FIELD,
  FILES_UPLOAD_TYPE_FIELD,
  FILES_UPLOADED_AT_FIELD,
  FILES_USER_INDEX_KEY,
  FILES_USER_INDEX_PUBLIC_KEY,
  FILES_USER_INDEX_UAT_KEY,
  FILES_USER_INDEX_UAT_PUBLIC_KEY,
  FILES_USR_ALIAS_PTR,
  FILES_WEBSITE_FIELD,
  STATUS_PROCESSED,
} = require('../../src/constant');
const { normalizeForSearch } = require('../../src/utils/normalize-name');

const skus = new Set();
const ids = new Set();
const names = new Set();

function createFakeFile({ owners, statuses }) {
  const owner = ld.sample(owners);
  const startedAt = faker.date.past().getTime();

  let sku = false;
  while (!sku) {
    const tempSku = faker.lorem.word();
    if (!skus.has(tempSku)) {
      skus.add(tempSku);
      sku = tempSku;
    }
  }

  const id = uuid.v4();
  const name = faker.commerce.productName();

  ids.add(id);
  names.add(name);

  return {
    [FILES_ALIAS_FIELD]: sku,
    [FILES_CONTENT_LENGTH_FIELD]: ld.random(1, 2132311),
    [FILES_DESCRIPTION_FIELD]: faker.commerce.productDescription(), // so it doesn't product unexpected results
    [FILES_ID_FIELD]: id,
    [FILES_NAME_FIELD]: name,
    [FILES_NAME_NORMALIZED_FIELD]: normalizeForSearch(name),
    [FILES_OWNER_FIELD]: owner,
    [FILES_UPLOAD_STARTED_AT_FIELD]: startedAt,
    [FILES_UPLOAD_TYPE_FIELD]: 'simple',
    [FILES_UPLOADED_AT_FIELD]: startedAt + 1000,
    [FILES_WEBSITE_FIELD]: `https://${faker.internet.domainName()}`,
    files: JSON.stringify([]), // can insert real files, but dont care
    parts: ld.random(1, 4),
    status: ld.sample(statuses),
  };
}

function insertFile(file) {
  const id = file.uploadId;
  const pipeline = this
    .files
    .redis
    .pipeline()
    .sadd(FILES_INDEX, id)
    .sadd(FILES_USER_INDEX_KEY(file.owner), id);

  if (ld.sample([0, 1]) === 1 && file.status === STATUS_PROCESSED) {
    file[FILES_PUBLIC_FIELD] = 1;
    pipeline.sadd(FILES_INDEX_PUBLIC, id);
    pipeline.sadd(FILES_USER_INDEX_PUBLIC_KEY(file.owner), id);

    pipeline.zadd(FILES_INDEX_UAT, file[FILES_UPLOADED_AT_FIELD], id);
    pipeline.zadd(FILES_INDEX_UAT_PUBLIC, file[FILES_UPLOADED_AT_FIELD], id);
    pipeline.zadd(FILES_USER_INDEX_UAT_KEY(file.owner), file[FILES_UPLOADED_AT_FIELD], id);
    pipeline.zadd(FILES_USER_INDEX_UAT_PUBLIC_KEY(file.owner), file[FILES_UPLOADED_AT_FIELD], id);
  }

  // for testing purposes we set this on every file
  const aliasPTRs = `${FILES_USR_ALIAS_PTR}:${file.owner}`;
  pipeline.hset(aliasPTRs, file[FILES_ALIAS_FIELD], id);

  pipeline.hmset(`${FILES_DATA}:${id}`, file);

  return pipeline.exec();
}

function insertData({ times, ...opts }) {
  return Promise.all(ld.times(times, () => insertFile.call(this, createFakeFile(opts))));
}

module.exports = { createFakeFile, insertFile, insertData, ids, skus, names };
