const { STATUS_PROCESSED } = require('../constant.js');

const params = {
  autorun: {
    type: 'boolean',
    default: false,
    description: 'Auto-start player',
  },
  width: {
    type: 'integer',
    default: 800,
    description: 'Width of embedded window',
  },
  height: {
    type: 'integer',
    default: 800,
    description: 'Height of embedded window',
  },
};

function getEmbeddedCode(id) {
  return `<iframe
    allowfullscreen
    width=“{{ width }}“
    height=“{{ height }}“
    border="0"
    src="https://api.cappasity.com/api/player/${id}/embedded?autorun={{ autorun }}“
  />`;
}

module.exports = function getEmbeddedInfo(data) {
  const { uploadId: id, status } = data.file;

  if (status === STATUS_PROCESSED) {
    data.file.embed = {
      code: getEmbeddedCode(id),
      params,
    };
  }

  return data;
};
