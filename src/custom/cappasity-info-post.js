const { STATUS_PROCESSED } = require('../constant.js');

const params = {
  autorun: {
    type: 'boolean',
    default: 0,
    description: 'Auto-start player',
  },
  closebutton: {
    type: 'boolean',
    default: 0,
    description: 'Show close button',
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
    mozallowfullscreen="true"
    webkitallowfullscreen="true"
    width="{{ width }}"
    height="{{ height }}"
    frameborder="0"
    style="border:0;"
    onmousewheel=""
    src="https://api.cappasity.com/api/player/${id}/embedded?autorun={{ autorun }}&closebutton={{ closebutton }}"
  ></iframe>`.replace(/\s+/g, ' ');
}

module.exports = function getEmbeddedInfo(file) {
  const { uploadId: id, status } = file;

  if (status === STATUS_PROCESSED) {
    file.embed = {
      code: getEmbeddedCode(id),
      params,
    };
  }

  return file;
};
