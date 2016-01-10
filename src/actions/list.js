const Promise = require('bluebird');
const fsort = require('redis-filtered-sort');

/**
 * List files
 * @return {Promise}
 */
module.exports = function postProcessFile(opts) {
  const { redis } = this;
  const { owner, filter } = opts;
  const criteria = opts.criteria;
  const strFilter = typeof filter === 'string' ? filter : fsort.filter(filter || {});
  const order = opts.order || 'ASC';
  const offset = opts.offset || 0;
  const limit = opts.limit || 10;

  // choose which set to use
  let filesIndex = 'files-index';
  if (owner) {
    filesIndex = `${filesIndex}:${owner}`;
  }

  return redis
    .fsort(filesIndex, 'files-data:*', criteria, order, strFilter, offset, limit)
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
        pipeline.hgetall(`files-data:${filename}`);
      });

      return Promise.join(
        filenames,
        pipeline.exec(),
        length
      );
    })
    .spread((filenames, props, length) => {
      const files = filenames.map(function remapData(filename, idx) {
        return props[idx][1];
      });

      return {
        files,
        cursor: offset + limit,
        page: Math.floor(offset / limit + 1),
        pages: Math.ceil(length / limit),
      };
    });
};
