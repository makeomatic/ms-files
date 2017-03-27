const Promise = require('bluebird');
const fetchData = require('../utils/fetchData.js');
const hasAccess = require('../utils/hasAccess.js');
const isProcessed = require('../utils/isProcessed.js');
const { bustCache } = require('../utils/bustCache.js');
const {
  FILES_INDEX, FILES_INDEX_PUBLIC,
  FILES_DATA, FILES_OWNER_FIELD, FILES_PUBLIC_FIELD,
  FILES_DIRECT_ONLY_FIELD,
} = require('../constant.js');

function addToPublic(filename, data) {
  const { provider, redis } = this;
  const { files } = data;
  const owner = data[FILES_OWNER_FIELD];
  const isDirectOnly = data[FILES_DIRECT_ONLY_FIELD];

  // in case this is a directOnly file,
  // we must not add it to public
  const index = `${FILES_INDEX}:${owner}:pub`;
  const id = `${FILES_DATA}:${filename}`;

  // get transport
  const transport = provider('access', data);

  return Promise
    .map(files, file => transport.makePublic(file.filename))
    .then(() => {
      const pipeline = redis
        .pipeline()
        .hset(id, FILES_PUBLIC_FIELD, 1);

      if (!isDirectOnly) {
        pipeline.sadd(index, filename);
        pipeline.sadd(FILES_INDEX_PUBLIC, filename);
      }

      return pipeline.exec();
    });
}

function removeFromPublic(filename, data) {
  const { provider, redis } = this;
  const { files } = data;
  const owner = data[FILES_OWNER_FIELD];

  // in case of removal we don't care if it's direct only
  // or not - it must not be in the public index
  const index = `${FILES_INDEX}:${owner}:pub`;
  const id = `${FILES_DATA}:${filename}`;

  // get transport
  const transport = provider('access', data);

  return Promise
    .map(files, file => transport.makePrivate(file.filename))
    .then(() =>
      redis
        .pipeline()
        .srem(index, filename)
        .srem(FILES_INDEX_PUBLIC, filename)
        .hdel(id, FILES_PUBLIC_FIELD)
        .exec()
    );
}

module.exports = function adjustAccess({ params }) {
  const { redis } = this;
  const { uploadId, setPublic, username } = params;
  const id = `${FILES_DATA}:${uploadId}`;

  return Promise
    .bind(this, id)
    .then(fetchData)
    .then(hasAccess(username))
    .then(isProcessed)
    .then(data =>
      Promise.bind(this, [uploadId, data])
        .spread(setPublic ? addToPublic : removeFromPublic)
        .tap(bustCache(redis, data, true))
    );
};
