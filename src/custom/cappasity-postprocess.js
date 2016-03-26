const Promise = require('bluebird');

const TYPE_MAP = {
  'c-preview': 'preview',
  'c-bin': 'model',
  'c-texture': 'texture',
  'c-archive': 'archive',
};

module.exports = function extractMetadata(data) {
  return Promise.try(function parseMeta() {
    const files = JSON.parse(data.files);
    const output = {};

    let textures = 0;
    files.forEach(({ type, filename }) => {
      const responsibility = TYPE_MAP[type];
      if (responsibility === 'texture') {
        output[`texture_${textures++}`] = filename;
      } else {
        output[responsibility] = filename;
      }
    });

    return output;
  });
};
