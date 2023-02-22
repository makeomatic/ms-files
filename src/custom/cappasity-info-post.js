// 1. для мешей старый вариант
// 2. для всех 3д вью - ротэйт опции
// 3. если 3двью имеет версию 4+ - добавляются зум опции

const flatstr = require('flatstr');
const memoize = require('lodash/memoize');

const {
  STATUS_PROCESSED,
  STATUS_PROCESSING,
  STATUS_FAILED,
  CAPPASITY_IMAGE_MODEL,
  UPLOAD_TYPE_GLB_EXTENDED,
  UPLOAD_TYPE_PANORAMA_EQUIRECT,
  UPLOAD_TYPE_PANORAMA_CUBEMAP,
} = require('../constant');

/*
  reqPlanLevel: integer. minimum required user plan level
             forbids changing option value
             for users with plan lvl less than given
             0 : free, 10 : lite, 20: basic, 30 : pro
 */

// adds key={{ key }} to .hbs-like template
const prepareTemplate = (key) => `${key}={{ ${key} }}`;
const getQueryString = (params) => Object.keys(params).map(prepareTemplate).join('&');

// default options
const corePlayerOpts = Object.setPrototypeOf({
  autorun: {
    type: 'boolean',
    default: 0,
    description: 'Auto-start player',
  },
  closebutton: {
    type: 'boolean',
    default: 1,
    description: 'Close button',
    // paid: false, <-- disabled as paid feature
    // reqPlanLevel: 30,
  },
  logo: {
    type: 'boolean',
    own: 0,
    default: 1,
    description: 'Show logo',
    paid: true,
    reqPlanLevel: 5,
  },
  analytics: {
    type: 'boolean',
    default: 1,
    description: 'Enable analytics',
  },
  uipadx: {
    type: 'integer',
    default: 0,
    description: 'Horizontal (left, right) UI padding in pixels',
  },
  uipady: {
    type: 'integer',
    default: 0,
    description: 'Vertical (top, bottom) UI padding in pixels',
  },
  enablestoreurl: {
    type: 'boolean',
    default: 0,
    paid: true,
    reqPlanLevel: 30,
    description: 'Enable product url',
  },
  storeurl: {
    type: 'string',
    default: '',
    paid: true,
    reqPlanLevel: 30,
    description: 'In-player link to the store page',
  },
  hidehints: {
    type: 'boolean',
    default: 0,
    description: 'Hide hints',
    paid: true,
    reqPlanLevel: 30,
  },
  language: {
    type: 'string',
    default: '',
    description: 'Player language',
  },
}, null);

// version 1.x.x - mesh
const meshPlayerOpts = Object.setPrototypeOf({
  hidefullscreen: {
    type: 'boolean',
    description: 'Hide fullscreen',
    default: 0,
  },
}, null);

// version 2.x.x+ - rotation features
const rotatePlayerOpts = Object.setPrototypeOf({
  autorotate: {
    type: 'boolean',
    default: 0,
    description: 'Autorotate',
    paid: true,
    reqPlanLevel: 30,
  },
  autorotatetime: {
    type: 'float',
    default: 10,
    description: 'Autorotate time, seconds',
    min: 2,
    max: 60,
    paid: true,
    reqPlanLevel: 30,
  },
  autorotatedelay: {
    type: 'float',
    default: 2,
    description: 'Autorotate delay, seconds',
    min: 1,
    max: 10,
    paid: true,
    reqPlanLevel: 30,
  },
  autorotatedir: {
    type: 'integer',
    default: 1,
    description: 'Autorotate direction',
    enum: {
      clockwise: 1,
      'counter-clockwise': -1,
    },
    paid: true,
    reqPlanLevel: 30,
  },
  hidefullscreen: {
    type: 'boolean',
    description: 'Hide fullscreen',
    default: 1,
    paid: true,
    reqPlanLevel: 30,
  },
  hideautorotateopt: {
    type: 'boolean',
    apps: 0, // higher priority than (own) when iframe is running in cappasity app
    own: 0,
    default: 1,
    invert: true,
    description: 'Autorotate button',
    paid: true,
    reqPlanLevel: 30,
  },
  hidesettingsbtn: {
    type: 'boolean',
    default: 0,
    description: 'Settings button',
    invert: true,
    paid: true,
    reqPlanLevel: 30,
  },
}, null);

// 4.x.x+ now
const zoomPlayerOpts = Object.setPrototypeOf({
  enableimagezoom: {
    type: 'boolean',
    default: 1,
    description: 'Enable zoom',
    paid: true,
    reqPlanLevel: 30,
  },
  zoomquality: {
    type: 'integer',
    default: 1,
    enum: {
      SD: 1,
      HD: 2,
    },
    description: 'Zoom quality',
    paid: true,
    reqPlanLevel: 30,
  },
  hidezoomopt: {
    type: 'boolean',
    default: 0,
    description: 'Zoom button',
    paid: true,
    invert: true,
    reqPlanLevel: 30,
  },
}, null);

const arPlayerOpts = Object.setPrototypeOf({
  arbutton: {
    type: 'boolean',
    default: 1,
    description: 'AR button',
    paid: true,
    reqPlanLevel: 40,
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

// prepare QS options
const coreQS = getQueryString(corePlayerOpts);
const meshQS = getQueryString(meshPlayerOpts);
const rotateQS = getQueryString(rotatePlayerOpts);
const zoomQS = getQueryString(zoomPlayerOpts);
const arQS = getQueryString(arPlayerOpts);

// common iframe code, lacks <id>
const iframePre = flatstr(`<iframe
  allowfullscreen
  mozallowfullscreen="true"
  webkitallowfullscreen="true"
  width="{{ width }}"
  height="{{ height }}"
  frameborder="0"
  style="border:0;"`.replace(/\s+/g, ' '));

// prepare options for 5 types of model - inserted after id
const iframeMesh = flatstr(`${coreQS}&${meshQS}`);
const iframeRotate = flatstr(`${coreQS}&${rotateQS}`);
const iframeZoom = flatstr(`${coreQS}&${rotateQS}&${zoomQS}&${arQS}`);
const iframePano = flatstr(`${coreQS}&${rotateQS}`);
const iframeGlbExtended = flatstr(`${coreQS}&${rotateQS}&${arQS}`);

// pregenerate option objects - 1.x.x
const paramsMesh = Object.setPrototypeOf({
  ...corePlayerOpts,
  ...meshPlayerOpts,
  ...defaultWindowOptions,
}, null);

// >= 2.x.x
const paramsRotate = Object.setPrototypeOf({
  ...corePlayerOpts,
  ...rotatePlayerOpts,
  ...defaultWindowOptions,
}, null);

// >= 4.x.x
const paramsZoom = Object.setPrototypeOf({
  ...corePlayerOpts,
  ...rotatePlayerOpts,
  ...zoomPlayerOpts,
  ...arPlayerOpts,
  ...defaultWindowOptions,
}, null);

// >= 5.x.x
const paramsPano = Object.setPrototypeOf({
  ...corePlayerOpts,
  ...rotatePlayerOpts,
  ...defaultWindowOptions,
}, null);

// >= 6.x.x
const paramsGlbExtended = Object.setPrototypeOf({
  ...corePlayerOpts,
  ...rotatePlayerOpts,
  ...arPlayerOpts,
  ...defaultWindowOptions,
  autoar: {
    type: 'boolean',
    default: 0,
    description: 'Auto-start Augmented Reality',
  },
}, null);

// quick-access selector
const MESH_TYPE = Symbol('mesh');
const ROTATE_TYPE = Symbol('rotate');
const ZOOM_TYPE = Symbol('zoom');
const PANO_TYPE = Symbol('pano');
const GLB_EXTENDED_TYPE = Symbol('glb-extended');

const selector = Object.setPrototypeOf({
  [MESH_TYPE]: Object.setPrototypeOf({
    qs: iframeMesh,
    params: paramsMesh,
  }, null),

  [ROTATE_TYPE]: Object.setPrototypeOf({
    qs: iframeRotate,
    params: paramsRotate,
  }, null),

  [ZOOM_TYPE]: Object.setPrototypeOf({
    qs: iframeZoom,
    params: paramsZoom,
  }, null),

  [PANO_TYPE]: Object.setPrototypeOf({
    qs: iframePano,
    params: paramsPano,
  }, null),

  [GLB_EXTENDED_TYPE]: Object.setPrototypeOf({
    qs: iframeGlbExtended,
    params: paramsGlbExtended,
  }, null),
}, null);

const is4 = (version) => /^4\./.test(version);

const getBaseUrl = memoize((apiDomain) => `https://${apiDomain}/api/player`);
const getAiHtml = memoize((apiDomain) => `<script async src="${getBaseUrl(apiDomain)}/cappasity-ai"></script>`);

const getPlayerOpts = (id, { uploadType, c_ver: modelVersion, packed }, apiDomain) => {
  let version;

  // if upload type isn't simple - means we have old mesh upload
  // generally c_ver -> 1.x.x
  if (uploadType !== CAPPASITY_IMAGE_MODEL) {
    switch (uploadType) {
      case UPLOAD_TYPE_GLB_EXTENDED:
        version = GLB_EXTENDED_TYPE;
        break;

      case UPLOAD_TYPE_PANORAMA_EQUIRECT:
      case UPLOAD_TYPE_PANORAMA_CUBEMAP:
        version = PANO_TYPE;
        break;

      default:
        version = MESH_TYPE;
        break;
    }
  } else {
    // if it's not a new .pack format -> it would be old images in 2.x.x format
    // next one is 3.x.x with old packs, doesn't have zoom either
    // and then 4.x.x is advanced packs, we don't want semver checks here for purpose of
    version = modelVersion === undefined || !packed || is4(modelVersion) === false
      ? ROTATE_TYPE
      : ZOOM_TYPE;
  }

  const data = selector[version];
  const baseUrl = getBaseUrl(apiDomain);
  const ai = getAiHtml(apiDomain);
  const code = `${iframePre} src="${baseUrl}/${id}/embedded?${data.qs}"></iframe>`;

  return {
    ai,
    code,
    params: data.params,
  };
};

// cached allowed statuses
const GREEN_LIGHT_STATUSES = Object.setPrototypeOf({
  [STATUS_PROCESSED]: true,
  [STATUS_PROCESSING]: true,
  [STATUS_FAILED]: true,
}, null);

// Actual code that populates .embed from predefined data
module.exports = function getEmbeddedInfo(file) {
  if (GREEN_LIGHT_STATUSES[file.status] === true) {
    const dynamicOptions = getPlayerOpts(file.uploadId, file, this.config.apiDomain);

    file.embed = {
      ai: dynamicOptions.ai,
      code: dynamicOptions.code,
      params: dynamicOptions.params,
    };
  }

  return file;
};
