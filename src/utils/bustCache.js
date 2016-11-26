const Promise = require('bluebird');

const {
  FILES_INDEX,
  FILES_INDEX_PUBLIC,
  FILES_INDEX_TEMP,

  FILES_PUBLIC_FIELD,
  FILES_TEMP_FIELD,
  FILES_OWNER_FIELD,
  FILES_UNLISTED_FIELD,
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

function getIndiciesList(file) {
  // unlisted file is not indexed
  if (isUnlisted(file)) {
    return [];
  }

  // Temporary file is contained only in index of temporary files
  if (isTemporary(file)) {
    return [FILES_INDEX_TEMP];
  }

  const username = file[FILES_OWNER_FIELD];
  const FILES_INDEX_USER = `${FILES_INDEX}:${username}`;

  // Basic indicies
  const INDICIES = [
    FILES_INDEX,
    FILES_INDEX_USER,
  ];

  if (isPublic(file)) {
    INDICIES.push(
      FILES_INDEX_PUBLIC,
      `${FILES_INDEX_USER}:pub`
    );
  }

  return INDICIES;
}

function bustCache(redis, file, wait = false) {
  const now = Date.now();

  if (isUnlisted(file)) {
    return Promise.resolve(null);
  }

  const indicies = getIndiciesList(file);
  const pipeline = Promise.map(indicies, index =>
    redis.fsortBust(index, now)
  );

  if (wait) {
    return pipeline;
  }

  return Promise.resolve(null);
}


module.exports.getIndiciesList = getIndiciesList;
module.exports.bustCache = bustCache;
