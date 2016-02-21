const Errors = require('common-errors');
const Promise = require('bluebird');
const fetchData = require('../utils/fetchData.js');
const hasAccess = require('../utils/hasAccess.js');
const {
  FILES_INDEX,
  FILES_INDEX_PUBLIC,
  FILES_DATA,
  FILES_OWNER_FIELD,
  FILES_PUBLIC_FIELD,
} = require('../constant.js');

function addToPublic(data) {
  const { provider, redis } = this;
  const { filename } = data;
  const owner = data[FILES_OWNER_FIELD];
  const index = `${FILES_INDEX}:${owner}:pub`;
  const id = `${FILES_DATA}:${filename}`;

  return provider
    .makePublic(filename)
    .then(() =>
      redis.pipeline()
        .sadd(index, filename)
        .sadd(FILES_INDEX_PUBLIC, filename)
        .hset(id, FILES_PUBLIC_FIELD, 1)
        .exec()
    );
}

function removeFromPublic(data) {
  const { provider, redis } = this;
  const { filename } = data;
  const owner = data[FILES_OWNER_FIELD];
  const index = `${FILES_INDEX}:${owner}:pub`;
  const id = `${FILES_DATA}:${filename}`;

  return provider
    .makePrivate(filename)
    .then(() =>
      redis.pipeline()
        .srem(index, filename)
        .srem(FILES_INDEX_PUBLIC, filename)
        .hdel(id, FILES_PUBLIC_FIELD)
        .exec()
    );
}

module.exports = function adjustAccess(opts) {
  const { filename, setPublic, owner } = opts;
  const id = `${FILES_DATA}:${filename}`;

  return Promise
    .bind(this, id)
    .then(fetchData)
    .then(hasAccess(owner))
    .tap(data => {
      if (data.owner) {
        return null;
      }

      throw new Errors.HttpStatusError(412, 'file must have an owner to adjust rights');
    })
    .then(setPublic ? addToPublic : removeFromPublic);
};
