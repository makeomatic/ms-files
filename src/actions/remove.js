const Promise = require('bluebird');
const { FILES_INDEX,
        FILES_DATA,
        FILES_PUBLIC_FIELD,
        FILES_OWNER_FIELD,
        FILES_INDEX_TAGS,
      } = require('../constant.js');
const hasAccess = require('../utils/hasAccess.js');
const fetchData = require('../utils/fetchData.js');

/**
 * Initiates upload
 * @param  {Object} opts
 * @param  {String} opts.username
 * @param  {String} opts.filename
 * @return {Promise}
 */
module.exports = function removeFile(opts) {
  const { filename, username } = opts;
  const { redis, provider } = this;
  const key = `${FILES_DATA}:${filename}`;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(hasAccess(username))
    .then(data => {
      const files = JSON.parse(data.files);

      return Promise
        .mapSeries(files, file => {
          return provider
            .remove(file.filename)
            .catch({ code: 404 }, err => {
              this.log.warn('file %s was already deleted', file.filename, err.code, err.message);
            });
        })
        .then(() => {
          const pipeline = redis.pipeline();
          pipeline.del(key);
          pipeline.srem(FILES_INDEX, filename);

          // removes from indices
          if (data[FILES_OWNER_FIELD]) {
            pipeline.srem(`${FILES_INDEX}:${data[FILES_OWNER_FIELD]}`, filename);
            if (data[FILES_PUBLIC_FIELD]) {
              pipeline.srem(`${FILES_INDEX}:${data[FILES_OWNER_FIELD]}:pub`, filename);
            }
          }

          if (data.tags) {
            data.tags.forEach(tag => pipeline.srem(`${FILES_INDEX_TAGS}:${tag}`, filename));
          }

          return pipeline.exec();
        });
    });
};
