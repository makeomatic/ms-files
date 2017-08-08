const {
  STATUS_PROCESSED,
  STATUS_PROCESSING,
  STATUS_FAILED,

  FILES_PLAYER_AUTORUN,
  FILES_PLAYER_CLOSEBUTTON,
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

// adds key={{ key }} to .hbs-like template
const prepareTemplate = key => `${key}={{ ${key} }}`;
const getQueryString = params => (
  Object.keys(params).map(prepareTemplate).join('&')
);

// default options
const defaultPlayerOpts = Object.setPrototypeOf({
  [FILES_PLAYER_AUTORUN]: {
    type: 'boolean',
    default: 0,
    description: 'Auto-start player',
    section: 'generic',
  },
  [FILES_PLAYER_CLOSEBUTTON]: {
    type: 'boolean',
    default: 1,
    description: 'Show close button',
    paid: true,
    reqPlanLevel: 30,
    section: 'pro',
  },
  [FILES_PLAYER_LOGO]: {
    type: 'boolean',
    default: 1,
    description: 'Show logo',
    paid: true,
    reqPlanLevel: 20,
    section: 'generic',
  },
  enableimagezoom: {
    type: 'boolean',
    default: 1,
    description: 'Enable Image Zoom',
    paid: true,
    reqPlanLevel: 30,
    section: 'pro',
  },
  zoomquality: {
    type: 'integer',
    default: 1,
    enum: {
      SD: 1,
      HD: 2,
    },
    description: 'Force Quality Settings',
    paid: true,
    reqPlanLevel: 30,
    section: 'pro',
  },
  autorotate: {
    type: 'boolean',
    default: 0,
    description: 'Autorotate 3D View',
    paid: true,
    reqPlanLevel: 30,
    section: 'pro',
  },
  autorotatetime: {
    type: 'float',
    default: 10,
    min: 0.1,
    paid: true,
    reqPlanLevel: 30,
    section: 'pro',
  },
  autorotatedelay: {
    type: 'float',
    default: 2,
    min: 0.1,
    paid: true,
    reqPlanLevel: 30,
    section: 'pro',
  },
  autorotatedir: {
    type: 'integer',
    default: 1,
    enum: {
      clockwise: 1,
      'counter-clockwise': -1,
    },
    paid: true,
    reqPlanLevel: 30,
    section: 'pro',
  },
  hidezoomopt: {
    type: 'boolean',
    default: 0,
    description: 'Hide Zoom Option',
    paid: true,
    reqPlanLevel: 30,
    section: 'pro',
  },
  hideautorotateopt: {
    type: 'boolean',
    default: 0,
    description: 'Hide Autorotate Option',
    paid: true,
    reqPlanLevel: 30,
    section: 'pro',
  },
  hidesettingsbtn: {
    type: 'boolean',
    default: 0,
    description: 'Hide Settings Button',
    paid: true,
    reqPlanLevel: 30,
    section: 'pro',
  },
}, null);

const defaultWindowOptions = Object.setPrototypeOf({
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
}, null);

const defaultQS = getQueryString(defaultPlayerOpts);

const defaultIframe = `<iframe
  allowfullscreen
  mozallowfullscreen="true"
  webkitallowfullscreen="true"
  width="{{ width }}"
  height="{{ height }}"
  frameborder="0"
  style="border:0;"
  onmousewheel=""
  src="https://api.cappasity.com/api/player/{{ id }}/embedded?${defaultQS}&{{ extraQS }}"
></iframe>`.replace(/\s+/g, ' ');

const getPlayerOpts = ({ uploadType }) => {
  const isImageModel = uploadType === CAPPASITY_IMAGE_MODEL;
  return {
    [FILES_PLAYER_HIDEFULLSCREEN]: {
      type: 'boolean',
      description: 'Hide fullscreen button',
      default: isImageModel ? 1 : 0,
      disabled: isImageModel,
    },
  };
};

const getEmbeddedCode = (id, qs) => (
  defaultIframe
    .replace('{{ id }}', id)
    .replace('{{ extraQS }}', qs)
);

// cached allowed statuses
const GREEN_LIGHT_STATUSES = Object.setPrototypeOf({
  [STATUS_PROCESSED]: true,
  [STATUS_PROCESSING]: true,
  [STATUS_FAILED]: true,
}, null);

module.exports = function getEmbeddedInfo(file) {
  const { uploadId: id, status } = file;

  if (GREEN_LIGHT_STATUSES[status] === true) {
    const dynamicOptions = getPlayerOpts(file);

    file.embed = {
      code: getEmbeddedCode(id, getQueryString(dynamicOptions)),
      params: {
        ...defaultPlayerOpts,
        ...dynamicOptions,
        ...defaultWindowOptions,
      },
    };
  }

  return file;
};
