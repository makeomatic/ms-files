const Promise = require('bluebird');

const TYPE_MAP = {
  'c-preview': 'preview',
  'c-bin': 'model',
  'c-texture': 'texture',
  'c-archive': 'archive',
};

module.exports = function extractMetadata(data) {
  return Promise.try(function parseMeta() {
    const parsedFiles = typeof data.files === 'string' ? JSON.parse(data.files) : data.files;
    const output = {};

    let textures = 0;
    parsedFiles.forEach(({ type, filename }) => {
      const responsibility = TYPE_MAP[type];
      if (responsibility === 'texture') {
        output[`texture_${textures++}`] = filename;
      } else {
        output[responsibility] = filename;
      }
    });

    // so that we don't parse it again later
    data.files = parsedFiles;

    return output;
  });
};
