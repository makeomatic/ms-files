const Promise = require('bluebird');
const fetchData = require('../utils/fetchData.js');
const hasAccess = require('../utils/hasAccess.js');
const isProcessed = require('../utils/isProcessed.js');
const { bustCache } = require('../utils/bustCache.js');
const {
  FILES_INDEX, FILES_INDEX_PUBLIC,
  FILES_DATA, FILES_OWNER_FIELD, FILES_PUBLIC_FIELD,
} = require('../constant.js');

function addToPublic(filename, data) {
  const { provider, redis } = this;
  const { files } = data;
  const owner = data[FILES_OWNER_FIELD];
  const index = `${FILES_INDEX}:${owner}:pub`;
  const id = `${FILES_DATA}:${filename}`;
  const transport = provider('access', data);

  return Promise
    .map(files, file => transport.makePublic(file.filename))
    .then(() => {
      return redis
        .pipeline()
        .sadd(index, filename)
        .sadd(FILES_INDEX_PUBLIC, filename)
        .hset(id, FILES_PUBLIC_FIELD, 1)
        .exec();
    });
}

function removeFromPublic(filename, data) {
  const { provider, redis } = this;
  const { files } = data;
  const owner = data[FILES_OWNER_FIELD];
  const index = `${FILES_INDEX}:${owner}:pub`;
  const id = `${FILES_DATA}:${filename}`;
  const transport = provider('access', data);

  return Promise
    .map(files, file => transport.makePrivate(file.filename))
    .then(() =>
      redis
        .pipeline()
        .srem(index, filename)
        .srem(FILES_INDEX_PUBLIC, filename)
        .hdel(id, FILES_PUBLIC_FIELD)
        .exec(),
    )
    .tap(bustCache(redis, data, true));
}

module.exports = function adjustAccess({ params }) {
  const { uploadId, setPublic, username } = params;
  const id = `${FILES_DATA}:${uploadId}`;

  return Promise
    .bind(this, id)
    .then(fetchData)
    .then(hasAccess(username))
    .then(isProcessed)
    .then(data => [uploadId, data])
    .spread(setPublic ? addToPublic : removeFromPublic);
};
