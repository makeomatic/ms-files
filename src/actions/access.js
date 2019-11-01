const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const handlePipeline = require('../utils/pipeline-error');
const fetchData = require('../utils/fetch-data');
const hasAccess = require('../utils/has-access');
const isProcessed = require('../utils/is-processed');
const { bustCache } = require('../utils/bust-cache');
const {
  FILES_INDEX, FILES_INDEX_PUBLIC,
  FILES_DATA, FILES_OWNER_FIELD, FILES_PUBLIC_FIELD,
  FILES_DIRECT_ONLY_FIELD,
} = require('../constant');

async function addToPublic(filename, data) {
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

  await Promise.map(files, (file) => (
    transport.makePublic(file.filename)
  ));

  const pipeline = redis
    .pipeline()
    .hset(id, FILES_PUBLIC_FIELD, 1);

  if (!isDirectOnly) {
    pipeline.sadd(index, filename);
    pipeline.sadd(FILES_INDEX_PUBLIC, filename);
  }

  return pipeline.exec().then(handlePipeline);
}

async function removeFromPublic(filename, data) {
  const { provider, redis } = this;
  const { files } = data;
  const owner = data[FILES_OWNER_FIELD];

  // in case of removal we don't care if it's direct only
  // or not - it must not be in the public index
  const index = `${FILES_INDEX}:${owner}:pub`;
  const id = `${FILES_DATA}:${filename}`;

  // get transport
  const transport = provider('access', data);

  await Promise.map(files, (file) => (
    transport.makePrivate(file.filename)
  ));

  return redis
    .pipeline()
    .srem(index, filename)
    .srem(FILES_INDEX_PUBLIC, filename)
    .hdel(id, FILES_PUBLIC_FIELD)
    .exec()
    .then(handlePipeline);
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
    .tap(bustCache(redis, data, true));
}

adjustAccess.transports = [ActionTransport.amqp];

module.exports = adjustAccess;
