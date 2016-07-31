const Promise = require('bluebird');
const fsort = require('redis-filtered-sort');
const is = require('is');
const noop = require('lodash/noop');
const fetchData = require('../utils/fetchData.js');
const {
  FILES_DATA,
  FILES_INDEX,
  FILES_INDEX_PUBLIC,
  FILES_INDEX_TAGS,
  FILES_INDEX_TEMP,
  FILES_LIST,
} = require('../constant.js');

/**
 * List files
 * @return {Promise}
 */
module.exports = function postProcessFile(opts) {
  const { redis, dlock, log, config: { interstoreKeyTTL, interstoreKeyMinTimeleft } } = this;
  const { owner, filter, public: isPublic, offset, limit, order, criteria, tags, temp, expiration = 30000 } = opts;
  const strFilter = is.string(filter) ? filter : fsort.filter(filter || {});

  return Promise
    .bind(this, ['files:info:pre', owner])
    .spread(this.hook)
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
      } else if (temp) {
        filesIndex = FILES_INDEX_TEMP;
      } else {
        filesIndex = FILES_INDEX;
      }

      if (!tags) {
        return filesIndex;
      }

      const tagKeys = [];
      let interstoreKey = `${FILES_LIST}:${filesIndex}`;

      tags.sort().forEach(tag => {
        const tagKey = `${FILES_INDEX_TAGS}:${tag}`;
        tagKeys.push(tagKey);
        interstoreKey = `${interstoreKey}:${tagKey}`;
      });

      return redis
        .pttl(interstoreKey)
        .then(result => {
          if (result > interstoreKeyMinTimeleft) {
            return interstoreKey;
          }

          return Promise.fromNode(next => {
            dlock
              .push(interstoreKey, next)
              .then(completed => {
                redis
                  .pipeline()
                  .sinterstore(interstoreKey, filesIndex, tagKeys)
                  .expire(interstoreKey, interstoreKeyTTL)
                  .exec()
                  .return(interstoreKey)
                  .asCallback(completed);
              })
              .catch({ name: 'LockAcquisitionError' }, noop)
              .catch(err => next(err));
          });
        });
    })
    .then(filesIndex => {
      return redis.fsort(filesIndex, `${FILES_DATA}:*`, criteria, order, strFilter, offset, limit, expiration);
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

      const pipeline = Promise.map(filenames, filename => fetchData.call(this, `${FILES_DATA}:${filename}`));
      return Promise.props({ filenames, props: pipeline, length });
    })
    .then(data => {
      const { filenames, props, length } = data;

      return Promise
        .map(filenames, (filename, idx) => {
          const fileData = props[idx];
          fileData.id = filename;
          return this.hook.call(this, 'files:info:post', fileData).return(fileData);
        })
        .then(files => ({
          files,
          cursor: offset + limit,
          page: Math.floor(offset / limit) + 1,
          pages: Math.ceil(length / limit),
        }));
    });
};
