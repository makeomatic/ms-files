const {
  STATUS_PROCESSED,
  FILES_PLAYER_AUTORUN,
  FILES_PLAYER_CLOSEBUTTON,
  FILES_PLAYER_HIDECONTROLS,
  FILES_PLAYER_LOGO,
} = require('../constant.js');

const defaultPlayerOpts = {
  [FILES_PLAYER_AUTORUN]: {
    type: 'boolean',
    default: 0,
    description: 'Auto-start player',
  },
  [FILES_PLAYER_CLOSEBUTTON]: {
    type: 'boolean',
    default: 1,
    description: 'Show close button',
  },
  [FILES_PLAYER_HIDECONTROLS]: {
    type: 'boolean',
    default: 0,
    description: 'Hide player controls',
    paid: true,
  },
  [FILES_PLAYER_LOGO]: {
    type: 'boolean',
    default: 1,
    paidDefault: 0,
    description: 'Show logo',
    paid: true,
  },
};

const defaultWindowOptions = {
  width: {
    type: 'integer',
    default: 800,
    description: 'Width of embedded window',
  },
  height: {
    type: 'integer',
    default: 600,
    description: 'Height of embedded window',
  },
};

function getQueryString(params) {
  return Object.keys(params).map(key => `${key}={{ ${key} }}`).join('&');
}

function getEmbeddedCode(id, qs) {
  return `<iframe
    allowfullscreen
    mozallowfullscreen="true"
    webkitallowfullscreen="true"
    width="{{ width }}"
    height="{{ height }}"
    frameborder="0"
    style="border:0;"
    onmousewheel=""
    src="https://api.cappasity.com/api/player/${id}/embedded?${qs}"
  ></iframe>`.replace(/\s+/g, ' ');
}

module.exports = function getEmbeddedInfo(file) {
  const { uploadId: id, status } = file;

  if (status === STATUS_PROCESSED) {
    file.embed = {
      code: getEmbeddedCode(id, getQueryString(defaultPlayerOpts)),
      params: {
        ...defaultPlayerOpts,
        ...defaultWindowOptions,
      },
    };
  }

  return file;
};
