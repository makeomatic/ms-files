const Promise = require('bluebird');

const {
  FILES_INDEX,
  FILES_INDEX_PUBLIC,
  FILES_INDEX_TAGS,
} = require('../constant');

const INDICIES = [
  FILES_INDEX,
  FILES_INDEX_TAGS,
  FILES_INDEX_PUBLIC,
];

function bust(redis) {
  return Promise.map(INDICIES, index => redis.fsortBust(index, Date.now()));
}

module.exports = function bustCache(redis, wait = false) {
  return () => {
    if (wait) {
      return bust(redis);
    }

    bust(redis);
    return null;
  };
};
