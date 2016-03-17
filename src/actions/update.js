const uuid = require('node-uuid');
const url = require('url');
const md5 = require('md5');
const { STATUS_PENDING, FILES_DATA, FILES_PUBLIC_FIELD } = require('../constant.js');

/**
 * Initiates update
 * @param  {Object} opts
 * @param  {Object} opts.meta
 * @param  {String} opts.updateId
 * @param  {String} opts.username
 * @return {Promise}
 */
module.exports = function initFileUpdate(opts) {
  const { meta, updateId, username } = opts;
  const { provider, redis } = this;
  const key = `${FILES_DATA}:${updateId}`;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(data => {

      const files = JSON.parse(data.files);

      if (!username) {
        throw new HttpStatusError(403, 'file does not belong to the provided user');
      } else {
        hasAccess(username)(data);

        Promise.map(files, file => {
          return provider.updateMetadata({ meta, resource: file.filename })
            .then(fileData => {
              return redis.pipeline()
                .hmset(key, fileData)
                .expire(key, 86400);
            });
        });
      }

      return Promise.props({ updateId, files });
    });
};
