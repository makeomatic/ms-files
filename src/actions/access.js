const { ActionTransport } = require('@microfleet/plugin-router');
const Promise = require('bluebird');
const handlePipeline = require('../utils/pipeline-error');
const fetchData = require('../utils/fetch-data');
const hasAccess = require('../utils/has-access');
const isProcessed = require('../utils/is-processed');
const { bustCache } = require('../utils/bust-cache');
const {
  FILES_DATA,
  FILES_OWNER_FIELD,
  FILES_PUBLIC_FIELD,
  FILES_DIRECT_ONLY_FIELD,
  FILES_INDEX_PUBLIC,
  FILES_INDEX_UAT_PUBLIC,
  FILES_USER_INDEX_PUBLIC_KEY,
  FILES_USER_INDEX_UAT_PUBLIC_KEY,
  FILES_UPLOADED_AT_FIELD,
} = require('../constant');

async function addToPublic(uploadId, data) {
  const { provider, redis } = this;
  const { files } = data;
  const owner = data[FILES_OWNER_FIELD];
  const isDirectOnly = data[FILES_DIRECT_ONLY_FIELD];

  // in case this is a directOnly file,
  // we must not add it to public
  const index = FILES_USER_INDEX_PUBLIC_KEY(owner);
  const id = `${FILES_DATA}:${uploadId}`;

  // get transport
  const transport = provider('access', data);

  await Promise.map(files, (file) => (
    transport.makePublic(file.filename)
  ));

  const pipeline = redis
    .pipeline()
    .hset(id, FILES_PUBLIC_FIELD, 1);

  if (!isDirectOnly) {
    pipeline.sadd(index, uploadId);
    pipeline.sadd(FILES_INDEX_PUBLIC, uploadId);
    pipeline.zadd(FILES_INDEX_UAT_PUBLIC, data[FILES_UPLOADED_AT_FIELD], uploadId);
    pipeline.zadd(FILES_USER_INDEX_UAT_PUBLIC_KEY(owner), data[FILES_UPLOADED_AT_FIELD], uploadId);
  }

  return handlePipeline(await pipeline.exec());
}

async function removeFromPublic(uploadId, data) {
  const { provider, redis } = this;
  const { files } = data;
  const owner = data[FILES_OWNER_FIELD];

  // in case of removal we don't care if it's direct only
  // or not - it must not be in the public index
  const index = FILES_USER_INDEX_PUBLIC_KEY(owner);
  const id = `${FILES_DATA}:${uploadId}`;

  // get transport
  const transport = provider('access', data);

  await Promise.map(files, (file) => (
    transport.makePrivate(file.filename)
  ));

  return handlePipeline(
    await redis
      .pipeline()
      .srem(index, uploadId)
      .srem(FILES_INDEX_PUBLIC, uploadId)
      .zrem(FILES_INDEX_UAT_PUBLIC, uploadId)
      .zrem(FILES_USER_INDEX_UAT_PUBLIC_KEY(owner), uploadId)
      .hdel(id, FILES_PUBLIC_FIELD)
      .exec()
  );
}

async function adjustAccess({ params }) {
  const { redis } = this;
  const { uploadId, setPublic, username } = params;
  const id = `${FILES_DATA}:${uploadId}`;

  const data = await Promise
    .bind(this, id)
    .then(fetchData)
    .then(hasAccess(username))
    .then(isProcessed);

  return Promise
    .bind(this, [uploadId, data])
    .spread(setPublic ? addToPublic : removeFromPublic)
    .tap(bustCache(redis, data, true, true));
}

adjustAccess.transports = [ActionTransport.amqp];

module.exports = adjustAccess;
