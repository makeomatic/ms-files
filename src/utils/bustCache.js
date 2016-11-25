const Promise = require('bluebird');

const {
  FILES_INDEX,
  FILES_INDEX_PUBLIC,
  FILES_INDEX_TEMP,
} = require('../constant');

function getIndices(file, username) {
  const FILES_INDEX_USER = `${FILES_INDEX}:${username}`;
  const FILES_INDEX_USER_PUB = `${FILES_INDEX_USER}:pub`;

  const INDICIES = [
    FILES_INDEX,
    FILES_INDEX_TEMP,
    FILES_INDEX_PUBLIC,
    FILES_INDEX_USER,
    FILES_INDEX_USER_PUB,
  ];

  return INDICIES;
}

function bust(redis, file, username) {
  const now = Date.now();
  const pipeline = redis.pipeline();
  const indicies = getIndices(file, username);

  indicies.forEach(index => pipeline.fsortBust(index, now));

  return pipeline.exec();
}

module.exports = function bustCache(redis, file, username, wait = false) {
  const promise = bust(redis, file, username);

  return Promise.resolve(wait ? promise : null);
};
