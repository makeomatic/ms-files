const { HttpStatusError } = require('common-errors');

module.exports = exports = Object.setPrototypeOf({
  STATUS_PENDING: '1',
  STATUS_UPLOADED: '2',
  STATUS_PROCESSED: '3',
  STATUS_PROCESSING: '4',
  STATUS_FAILED: '5',

  FILES_INDEX_TEMP: 'files-index-temp',
  FILES_INDEX: 'files-index',
  FILES_INDEX_PUBLIC: 'files-index-pub',
  FILES_INDEX_TAGS: 'files-index-tags',

  FILES_LIST: 'files-list',
  FILES_DATA: 'files-data',
  FILES_POST_ACTION: 'files-post',
  UPLOAD_DATA: 'upload-data',

  PREVIEW_PREFIX: 'preview:',

  WEBHOOK_RESOURCE_ID: 'gce:webhook',

  // in combination with {owner} generates pointers
  FILES_USR_ALIAS_PTR: 'files-ptr-user',

  // field names
  FILES_ALIAS_FIELD: 'alias',
  FILES_BUCKET_FIELD: 'bucket',
  FILES_PROCESS_ERROR_FIELD: 'error',
  FILES_PROCESS_ERROR_COUNT_FIELD: 'error-count',
  FILES_OWNER_FIELD: 'owner',
  FILES_PUBLIC_FIELD: 'public',
  FILES_PACKED_FIELD: 'packed',
  FILES_TAGS_FIELD: 'tags',
  FILES_TEMP_FIELD: 'temporary',
  FILES_STATUS_FIELD: 'status',
  FILES_PARTS_FIELD: 'parts',
  FILES_UNLISTED_FIELD: 'unlisted',
  FILES_CONTROLS_FIELD: 'controlsData',
  FILES_EXPORT_FIELD: 'export',
  FILES_DIRECT_ONLY_FIELD: 'direct',
  FILES_BACKGROUND_IMAGE_FIELD: 'backgroundImage',
  FILES_BACKGROUND_COLOR_FIELD: 'backgroundColor',
  FILES_CONTENT_LENGTH_FIELD: 'contentLength',

  // metatype of file
  FILES_TYPE_FIELD: 'type',
  FILES_TYPE_DEFAULT: 'default',
  FILES_TYPE_OBJECT: 'object',
  FILES_TYPE_DSLR: 'dslr',
  FILES_TYPE_HUMAN: 'human',
  FILES_TYPE_USER: 'user',

  // type map
  TYPE_MAP: Object.setPrototypeOf({
    'c-bin': '.bin.gz',
    'c-texture': '.jpeg',
    'c-preview': '.jpeg',
    'c-archive': '.zip',
    'c-pack': '.pack',
  }, null),

  // errors
  FILE_MISSING_ERROR: new HttpStatusError(404, 'could not find associated data'),
  FILE_PROCESS_IN_PROGRESS_ERROR: new HttpStatusError(409, 'file is being processed'),
}, null);

exports.FIELDS_TO_STRINGIFY = [
  exports.FILES_TAGS_FIELD,
  exports.FILES_EXPORT_FIELD,
  exports.FILES_CONTROLS_FIELD,
];

exports.CAPPASITY_3D_MODEL = 'model';
exports.CAPPASITY_IMAGE_MODEL = 'simple';
exports.CAPPASITY_TYPE_MAP = Object.setPrototypeOf({
  'c-preview': 'preview',
  'c-texture': 'texture',
  'c-archive': 'archive',
  'c-bin': exports.CAPPASITY_3D_MODEL,
  'c-simple': exports.CAPPASITY_IMAGE_MODEL,
  'c-pack': exports.CAPPASITY_IMAGE_MODEL,
}, null);

exports.LOCK_UPDATE_KEY = uploadId => `file:update:${uploadId}`;
exports.FILES_DATA_INDEX_KEY = uploadId => `${exports.FILES_DATA}:${uploadId}`;
exports.FILES_TAGS_INDEX_KEY = tag => `${exports.FILES_INDEX_TAGS}:${tag}`;
