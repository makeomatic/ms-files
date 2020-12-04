const ld = require('lodash');
const Promise = require('bluebird');
const faker = require('faker');
const uuid = require('uuid');
const {
  STATUS_PROCESSED,
  FILES_DATA,
  FILES_INDEX,
  FILES_INDEX_PUBLIC,
  FILES_OWNER_FIELD,
  FILES_PUBLIC_FIELD,
  FILES_USER_INDEX_KEY,
  FILES_USER_INDEX_PUBLIC_KEY,
} = require('../../src/constant.js');

function createFakeFile({ owners, statuses }) {
  const owner = ld.sample(owners);
  const startedAt = faker.date.past().getTime();

  return {
    uploadId: uuid.v4(),
    status: ld.sample(statuses),
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
    .sadd(FILES_USER_INDEX_KEY(file.owner), id);

  if (ld.sample([0, 1]) === 1 && file.status === STATUS_PROCESSED) {
    file[FILES_PUBLIC_FIELD] = 1;
    pipeline.sadd(FILES_INDEX_PUBLIC, id);
    pipeline.sadd(FILES_USER_INDEX_PUBLIC_KEY(file.owner), id);
  }

  pipeline.hmset(`${FILES_DATA}:${id}`, file);

  return pipeline.exec();
}

function insertData({ times, ...opts }) {
  return Promise.all(ld.times(times, () => insertFile.call(this, createFakeFile(opts))));
}

module.exports = { createFakeFile, insertFile, insertData };
