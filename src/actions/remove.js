const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const hasAccess = require('../utils/hasAccess');
const fetchData = require('../utils/fetchData');
const isUnlisted = require('../utils/isUnlisted');
const { bustCache } = require('../utils/bustCache');
const {
  FILES_INDEX,
  FILES_INDEX_PUBLIC,
  FILES_DATA,
  FILES_PUBLIC_FIELD,
  FILES_OWNER_FIELD,
  FILES_INDEX_TAGS,
  FILES_TAGS_FIELD,
  FILES_ALIAS_FIELD,
  FILES_USR_ALIAS_PTR,
} = require('../constant');
const pipelineError = require('../utils/pipelineError');

/**
 * This function used as coroutine, we don't track the result
 * of this action
 */
function cleanupFileProvider(files, provider, log, opts = { concurrency: 20 }) {
  return Promise
    .map(files, (file) => (
      provider
        .remove(file.filename)
        .catch({ code: 404 }, (err) => {
          log.warn('file %s was already deleted', file.filename, err.code, err.message);
        })
    ), opts);
}

/**
 * Initiates upload
 * @param  {Object} opts
 * @param  {String} opts.username
 * @param  {String} opts.filename
 * @return {Promise}
 */
async function removeFile({ params }) {
  const { filename, username } = params;
  const { redis, log } = this;
  const provider = this.provider('remove', params);
  const key = `${FILES_DATA}:${filename}`;

  const data = await Promise
    .bind(this, key)
    .then(fetchData)
    .then(isUnlisted)
    .then(hasAccess(username));

  // we do not track this
  cleanupFileProvider(data.files, provider, log)
    .catch((e) => log.fatal({ err: e }, 'failed to cleanup file provider for %s', filename));

  // cleanup local database
  const pipeline = redis.pipeline();
  const owner = data[FILES_OWNER_FIELD];

  pipeline
    .del(key)
    .srem(FILES_INDEX, filename)
    .srem(`${FILES_INDEX}:${owner}`, filename);

  if (data[FILES_PUBLIC_FIELD]) {
    pipeline.srem(FILES_INDEX_PUBLIC, filename);
    pipeline.srem(`${FILES_INDEX}:${owner}:pub`, filename);
  }

  const tags = data[FILES_TAGS_FIELD];
  if (tags) {
    tags.forEach((tag) => pipeline.srem(`${FILES_INDEX_TAGS}:${tag}`, filename));
  }

  // remove pointer for the alias if it existed
  const alias = data[FILES_ALIAS_FIELD];
  if (alias) {
    pipeline.hdel(`${FILES_USR_ALIAS_PTR}:${owner}`, alias);
  }

  // execute pipeline and bustCache right after
  return pipeline
    .exec()
    .tap(bustCache(redis, data))
    .then(pipelineError);
}

removeFile.transports = [ActionTransport.amqp];
module.exports = removeFile;
