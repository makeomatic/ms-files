const Promise = require('bluebird');
const fsort = require('redis-filtered-sort');
const is = require('is');
const { FILES_DATA, FILES_INDEX, FILES_INDEX_PUBLIC } = require('../constant.js');

/**
 * List files
 * @return {Promise}
 */
module.exports = function postProcessFile(opts) {
  const { redis, log } = this;
  const { owner, filter, public: isPublic, offset, limit, order, criteria } = opts;
  const strFilter = is.string(filter) ? filter : fsort.filter(filter || {});

  return Promise
    .bind(this, ['files:info:pre', owner])
    .spread(this.postHook)
    .spread(username => {
      log.debug('[list]: resolved %s to %s', owner, username);

      // choose which set to use
      let filesIndex;
      if (isPublic && username) {
        filesIndex = `${FILES_INDEX}:${username}:pub`;
      } else if (username) {
        filesIndex = `${FILES_INDEX}:${username}`;
      } else if (isPublic) {
        filesIndex = FILES_INDEX_PUBLIC;
      } else {
        filesIndex = FILES_INDEX;
      }

      return redis.fsort(filesIndex, `${FILES_DATA}:*`, criteria, order, strFilter, offset, limit);
    })
    .then(filenames => {
      const length = +filenames.pop();
      if (length === 0 || filenames.length === 0) {
        return {
          filenames,
          props: [],
          length,
        };
      }

      const pipeline = redis.pipeline();
      filenames.forEach(filename => {
        pipeline.hgetall(`${FILES_DATA}:${filename}`);
      });

      return Promise.props({ filenames, props: pipeline.exec(), length });
    })
    .then(data => {
      const { filenames, props, length } = data;
      const files = filenames.map(function remapData(filename, idx) {
        const meta = props[idx][1];

        return {
          ...meta,
          id: filename,
          files: JSON.parse(meta.files),
        };
      });

      return {
        files,
        cursor: offset + limit,
        page: Math.floor(offset / limit + 1),
        pages: Math.ceil(length / limit),
      };
    });
};
