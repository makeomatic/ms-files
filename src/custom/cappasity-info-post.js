const {
  STATUS_PROCESSED,
  STATUS_PROCESSING,
  STATUS_FAILED,

  FILES_PLAYER_AUTORUN,
  FILES_PLAYER_CLOSEBUTTON,
  FILES_PLAYER_HIDECONTROLS,
  FILES_PLAYER_HIDEFULLSCREEN,
  FILES_PLAYER_LOGO,

  CAPPASITY_IMAGE_MODEL,
} = require('../constant.js');

/*
  reqPlanLevel: integer. minimum required user plan level
             forbids changing option value
             for users with plan lvl less than given
             0 : free, 10 : lite, 20: basic, 30 : pro
 */

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
      reqPlanLevel: 30,
    },
    [FILES_PLAYER_HIDECONTROLS]: {
      type: 'boolean',
      description: 'Hide player controls',
      default: 0,
      paid: true,
      reqPlanLevel: 30,
    },
    [FILES_PLAYER_LOGO]: {
      type: 'boolean',
      default: 1,
      description: 'Show logo',
      paid: true,
      reqPlanLevel: 20,
    },
    [FILES_PLAYER_HIDEFULLSCREEN]: {
      type: 'boolean',
      default: isImageModel ? 1 : 0,
      description: 'Hide fullscreen button',
      disabled: isImageModel,
    },
  };

  return defaultPlayerOpts;
}

const defaultWindowOptions = {
  width: {
    type: 'string',
    default: '100%',
    description: 'Width of embedded window (px or %)',
  },
  height: {
    type: 'string',
    default: '600px',
    description: 'Height of embedded window (px or %)',
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

// cached allowed statuses
const GREEN_LIGHT_STATUSES = {
  [STATUS_PROCESSED]: true,
  [STATUS_PROCESSING]: true,
  [STATUS_FAILED]: true,
};

module.exports = function getEmbeddedInfo(file) {
  const { uploadId: id, status } = file;

  if (GREEN_LIGHT_STATUSES[status] === true) {
    const options = getPlayerOpts(file);
    file.embed = {
      code: getEmbeddedCode(id, getQueryString(options)),
      params: {
        ...options,
        ...defaultWindowOptions,
      },
    };
  }

  return file;
};
