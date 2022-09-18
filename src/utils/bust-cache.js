const Promise = require('bluebird');

const {
  FILES_INDEX,
  FILES_INDEX_PUBLIC,
  FILES_INDEX_TEMP,
  FILES_USER_INDEX_KEY,

  FILES_PUBLIC_FIELD,
  FILES_TEMP_FIELD,
  FILES_OWNER_FIELD,
  FILES_UNLISTED_FIELD,
  FILES_USER_INDEX_PUBLIC_KEY,
} = require('../constant');

function isUnlisted(file) {
  return file[FILES_UNLISTED_FIELD];
}

function isTemporary(file) {
  return file[FILES_TEMP_FIELD];
}

function isPublic(file) {
  return file[FILES_PUBLIC_FIELD];
}

function getIndiciesList(file, accessChanged) {
  // unlisted file is not indexed
  if (isUnlisted(file)) {
    return [];
  }

  // Temporary file is contained only in index of temporary files
  if (isTemporary(file)) {
    return [FILES_INDEX_TEMP];
  }

  const username = file[FILES_OWNER_FIELD];
  const FILES_INDEX_USER = FILES_USER_INDEX_KEY(username);

  // Basic indicies
  const INDICIES = [
    FILES_INDEX,
    FILES_INDEX_USER,
  ];

  if (isPublic(file) || accessChanged) {
    INDICIES.push(
      FILES_INDEX_PUBLIC,
      FILES_USER_INDEX_PUBLIC_KEY(username)
    );
  }

  return INDICIES;
}

function bustCache(redis, file, accessChanged, wait = false) {
  const now = Date.now();

  if (isUnlisted(file)) {
    return Promise.resolve(null);
  }

  const indicies = getIndiciesList(file, accessChanged);
  const pipeline = Promise.map(indicies, (index) => redis.fsortBust(index, now));

  if (wait) {
    return pipeline;
  }

  return Promise.resolve(null);
}

module.exports.getIndiciesList = getIndiciesList;
module.exports.bustCache = bustCache;
