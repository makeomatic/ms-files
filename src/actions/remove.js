const { ActionTransport } = require('@microfleet/plugin-router');
const Promise = require('bluebird');
const hasAccess = require('../utils/has-access');
const fetchData = require('../utils/fetch-data');
const isUnlisted = require('../utils/is-unlisted');
const { assertUpdatable, isClone, hasClone } = require('../utils/check-data');
const { bustCache } = require('../utils/bust-cache');
const { getReferenceData, updateReferences } = require('../utils/reference');
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
  FILES_USER_INDEX_KEY,
  FILES_USER_INDEX_PUBLIC_KEY,
  FILES_REFERENCES_FIELD,
} = require('../constant');
const pipelineError = require('../utils/pipeline-error');

/**
 * This function used as coroutine, we don't track the result
 * of this action
 */
function cleanupFileProvider(service, data, opts = { concurrency: 20 }) {
  return Promise.map(data.files, (file) => {
    const { filename } = file;
    const provider = service.provider('remove', data, file);
    const shouldDeleteCloneFile = !hasClone(data) || provider.canCopy();

    if (!shouldDeleteCloneFile) {
      return Promise.resolve();
    }

    return provider
      .remove(filename)
      .catch({ code: 404 }, (err) => {
        service.log.warn('file %s was already deleted', filename, err.code, err.message);
      });
  }, opts);
}

/**
 * Initiates upload
 * @param  {Object} opts
 * @param  {String} opts.username
 * @param  {String} opts.filename
 * @return {Promise}
 */
async function removeFile({ params }) {
  const { filename, username, softDelete } = params;
  const { redis, log } = this;
  const key = `${FILES_DATA}:${filename}`;

  const data = await Promise
    .bind(this, key)
    .then(fetchData)
    .then(isUnlisted)
    .then(hasAccess(username))
    .then(assertUpdatable({}, true));

  if (!softDelete && !isClone(data)) {
    // we do not track this
    cleanupFileProvider(this, data).catch(
      (e) => log.fatal({ err: e }, 'failed to cleanup file provider for %s', filename)
    );
  }

  // cleanup local database
  const pipeline = redis.pipeline();
  const owner = data[FILES_OWNER_FIELD];

  pipeline
    .del(key)
    .srem(FILES_INDEX, filename)
    .srem(FILES_USER_INDEX_KEY(owner), filename);

  if (data[FILES_PUBLIC_FIELD]) {
    pipeline.srem(FILES_INDEX_PUBLIC, filename);
    pipeline.srem(FILES_USER_INDEX_PUBLIC_KEY(owner), filename);
  }

  if (data[FILES_REFERENCES_FIELD]) {
    const referenceData = getReferenceData(redis, data[FILES_REFERENCES_FIELD]);
    updateReferences({ ...data, [FILES_REFERENCES_FIELD]: [] }, data, referenceData, pipeline);
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
    .tap(bustCache(redis, data, false))
    .then(pipelineError);
}

removeFile.transports = [ActionTransport.amqp];
module.exports = removeFile;
