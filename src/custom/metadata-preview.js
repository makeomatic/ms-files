const Promise = require('bluebird');
const IMAGE_SIZE = { start: 0, end: 3 };
const HASH_SIZE = { end: -16 };

module.exports = function extractMetadata(provider, { key, data, redis }) {
  const { filename } = data;

  return Promise.join(
    provider.readFile(filename, IMAGE_SIZE),
    provider.readFile(filename, HASH_SIZE),
  )
  .spread(function addMetadata(image, md5) {
    const imageLength = image.contents.readInt32BE(0);
    const md5Hash = md5.contents.toString('hex');
    const contentLength = parseInt(image.response.headers['content-length'], 10) - 20 - imageLength;
    const output = {
      previewSize: imageLength,
      modelSize: contentLength,
      checksum: md5Hash,
    };

    return redis.hmset(key, output).return(output);
  });
};
