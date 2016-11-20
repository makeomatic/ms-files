const {
  STATUS_PROCESSED,
  FILES_PLAYER_AUTORUN,
  FILES_PLAYER_CLOSEBUTTON,
  FILES_PLAYER_HIDECONTROLS,
  FILES_PLAYER_HIDEFULLSCREEN,
  FILES_PLAYER_LOGO,

  CAPPASITY_IMAGE_MODEL,
} = require('../constant.js');

function getPlayerOpts({ uploadType }) {
  const isImageModel = uploadType === CAPPASITY_IMAGE_MODEL;
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
      paid: true,
    },
    [FILES_PLAYER_HIDECONTROLS]: {
      type: 'boolean',
      description: 'Hide player controls',
      default: 0,
      paid: true,
      disabled: isImageModel,
    },
    [FILES_PLAYER_LOGO]: {
      type: 'boolean',
      default: 1,
      description: 'Show logo',
      paid: true,
    },
    [FILES_PLAYER_HIDEFULLSCREEN]: {
      type: 'boolean',
      default: isImageModel ? 1 : 0,
      description: 'Hide fullscreen button',
    },
  };

  return defaultPlayerOpts;
}

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
        ...getPlayerOpts(file),
        ...defaultWindowOptions,
      },
    };
  }

  return file;
};
