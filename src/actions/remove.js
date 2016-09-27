const Promise = require('bluebird');
const hasAccess = require('../utils/hasAccess.js');
const fetchData = require('../utils/fetchData.js');
const isUnlisted = require('../utils/isUnlisted.js');
const { FILES_INDEX,
  FILES_DATA,
  FILES_PUBLIC_FIELD,
  FILES_OWNER_FIELD,
  FILES_INDEX_TAGS,
  FILES_TAGS_FIELD,
} = require('../constant.js');

/**
 * Initiates upload
 * @param  {Object} opts
 * @param  {String} opts.username
 * @param  {String} opts.filename
 * @return {Promise}
 */
module.exports = function removeFile({ params }) {
  const { filename, username } = params;
  const { redis } = this;
  const provider = this.provider('remove', params);
  const key = `${FILES_DATA}:${filename}`;

  return Promise
    .bind(this, key)
    .then(fetchData)
    .then(isUnlisted)
    .then(hasAccess(username))
    .then((data) => {
      const { files } = data;

      return Promise
        .mapSeries(files, (file) => {
          return provider
            .remove(file.filename)
            .catch({ code: 404 }, (err) => {
              this.log.warn('file %s was already deleted', file.filename, err.code, err.message);
            });
        })
        .then(() => {
          const pipeline = redis.pipeline();
          pipeline
            .del(key)
            .srem(FILES_INDEX, filename)
            .srem(`${FILES_INDEX}:${data[FILES_OWNER_FIELD]}`, filename);

          if (data[FILES_PUBLIC_FIELD]) {
            pipeline.srem(`${FILES_INDEX}:${data[FILES_OWNER_FIELD]}:pub`, filename);
          }

          if (data[FILES_TAGS_FIELD]) {
            data[FILES_TAGS_FIELD].forEach(tag => pipeline.srem(`${FILES_INDEX_TAGS}:${tag}`, filename));
          }

          return pipeline.exec();
        });
    });
};
