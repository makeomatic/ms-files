module.exports = exports = {
  STATUS_PENDING: '1',
  STATUS_UPLOADED: '2',
  STATUS_PROCESSED: '3',
  STATUS_PROCESSING: '4',
  STATUS_FAILED: '5',

  FILES_INDEX_TEMP: 'files-index-temp',
  FILES_INDEX: 'files-index',
  FILES_INDEX_PUBLIC: 'files-index-pub',
  FILES_DATA: 'files-data',
  UPLOAD_DATA: 'upload-data',
  PREVIEW_PREFIX: 'preview:',
  WEBHOOK_RESOURCE_ID: 'gce:webhook',
  FILES_INDEX_TAGS: 'files-index-tags',
  FILES_LIST: 'files-list',
  // field names
  FILES_BUCKET_FIELD: 'bucket',
  FILES_PROCESS_ERROR_FIELD: 'error',
  FILES_OWNER_FIELD: 'owner',
  FILES_PUBLIC_FIELD: 'public',
  FILES_TAGS_FIELD: 'tags',
  FILES_TEMP_FIELD: 'temporary',
  FILES_STATUS_FIELD: 'status',
  FILES_PARTS_FIELD: 'parts',
  FILES_UNLISTED_FIELD: 'unlisted',
  FILES_CONTROLS_FIELD: 'controlsData',
  FILES_EXPORT_FIELD: 'export',
  FILES_BACKGROUND_IMAGE_FIELD: 'backgroundImage',
  FILES_BACKGROUND_COLOR_FIELD: 'backgroundColor',

  // metatype of file
  FILES_TYPE_FIELD: 'type',
  FILES_TYPE_DEFAULT: 'default',
  FILES_TYPE_OBJECT: 'object',
  FILES_TYPE_DSLR: 'dslr',
  FILES_TYPE_HUMAN: 'human',
  FILES_TYPE_USER: 'user',

  // type map
  TYPE_MAP: {
    'c-bin': '.bin.gz',
    'c-texture': '.jpeg',
    'c-preview': '.jpeg',
    'c-archive': '.zip',
  },

  FILES_PLAYER_AUTORUN: 'autorun',
  FILES_PLAYER_CLOSEBUTTON: 'closebutton',
  FILES_PLAYER_HIDECONTROLS: 'hidecontrols',
  FILES_PLAYER_LOGO: 'logo',
  FILES_PLAYER_HIDEFULLSCREEN: 'hidefullscreen',
};

exports.FIELDS_TO_STRINGIFY = [
  exports.FILES_TAGS_FIELD,
  exports.FILES_EXPORT_FIELD,
  exports.FILES_CONTROLS_FIELD,
];

exports.CAPPASITY_TYPE_MAP = {
  'c-preview': 'preview',
  'c-bin': 'model',
  'c-texture': 'texture',
  'c-archive': 'archive',
  'c-simple': 'simple',
};
