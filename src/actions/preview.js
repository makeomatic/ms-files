const sharp = require('sharp');
const { FILES_DATA } = require('../constant.js');
sharp.cache(false);

module.exports = function generatePreview(opts) {
  const { redis } = this;
  const { id, size, format } = opts;
  const key = `${FILES_DATA}:${id}`;

  return redis.hgetall(key).then(data => {

  });
};
