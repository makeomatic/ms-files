const {
  STATUS_PROCESSED,
  FILES_PLAYER_AUTORUN,
  FILES_PLAYER_CLOSEBUTTON,
  FILES_PLAYER_HIDECONTROLS,
  FILES_PLAYER_LIMITNAME,
  FILES_PLAYER_BACKGROUND_URL,
  FILES_PLAYER_BACKGROUND_COLOR,
  FILES_TYPES_MAP,
  FILES_TYPE_FIELD,
} = require('../constant.js');

const defaultPlayerOpts = {
  [FILES_PLAYER_AUTORUN]: {
    type: 'boolean',
    default: 0,
    description: 'Auto-start player',
    paid: true,
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
  [FILES_PLAYER_LIMITNAME]: {
    type: 'string',
    default: 'default',
    description: 'Model controls limit preset',
    path: `file.attributes.${FILES_TYPE_FIELD}`,
    enum: FILES_TYPES_MAP,
  },
  [FILES_PLAYER_BACKGROUND_COLOR]: {
    type: 'string',
    default: 'rgb(255,255,255)',
    description: 'Color of background in rgb(r, g, b) or hex("#rrbbcc") variant.',
    paid: true,
  },
  [FILES_PLAYER_BACKGROUND_URL]: {
    type: 'string',
    default: null,
    description: 'Background image URL',
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
