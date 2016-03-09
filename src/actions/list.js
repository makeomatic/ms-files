const Promise = require('bluebird');
const fsort = require('redis-filtered-sort');
const is = require('is');
const { FILES_DATA, FILES_INDEX, FILES_INDEX_PUBLIC } = require('../constant.js');

/**
 * List files
 * @return {Promise}
 */
module.exports = function postProcessFile(opts) {
  const { redis } = this;
  const { owner, filter, public: isPublic, offset, limit, order, criteria } = opts;
  const strFilter = is.string(filter) ? filter : fsort.filter(filter || {});

  // choose which set to use
  let filesIndex;
  if (isPublic && owner) {
    filesIndex = `${FILES_INDEX}:${owner}:pub`;
  } else if (owner) {
    filesIndex = `${FILES_INDEX}:${owner}`;
  } else if (isPublic) {
    filesIndex = FILES_INDEX_PUBLIC;
  } else {
    filesIndex = FILES_INDEX;
  }

  return redis
    .fsort(filesIndex, `${FILES_DATA}:*`, criteria, order, strFilter, offset, limit)
    .then(filenames => {
      const length = +filenames.pop();
      if (length === 0 || filenames.length === 0) {
        return [
          filenames || [],
          [],
          length,
        ];
      }

      const pipeline = redis.pipeline();
      filenames.forEach(filename => {
        pipeline.hgetall(`${FILES_DATA}:${filename}`);
      });

      return Promise.join(
        filenames,
        pipeline.exec(),
        length
      );
    })
    .spread((filenames, props, length) => {
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
