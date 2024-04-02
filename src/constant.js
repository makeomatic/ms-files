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
  FILES_INDEX_UAT: 'files-index-uat',
  FILES_INDEX_UAT_PUBLIC: 'files-index-uat-pub',

  FILES_INDEX_REFERENCED: 'files-index-referenced',

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
  FILES_ID_FIELD: 'uploadId',
  FILES_BACKGROUND_IMAGE_FIELD: 'backgroundImage',
  FILES_BACKGROUND_COLOR_FIELD: 'backgroundColor',
  FILES_CONTENT_LENGTH_FIELD: 'contentLength',
  FILES_UPLOADED_AT_FIELD: 'uploadedAt',
  FILES_UPLOAD_STARTED_AT_FIELD: 'startedAt',
  FILES_UPLOAD_TYPE_FIELD: 'uploadType',
  FILES_VERSION_FIELD: 'version',
  FILES_HAS_NFT: 'hn',
  FILES_NAME_FIELD: 'name',
  FILES_NAME_NORMALIZED_FIELD: 'name_n',
  FILES_DESCRIPTION_FIELD: 'description',
  FILES_WEBSITE_FIELD: 'website',
  FILES_IMMUTABLE_FIELD: 'immutable',
  FILES_PARENT_FIELD: 'parentId',
  FILES_HAS_CLONES_FIELD: 'hasClones',
  FILES_CLONES_COUNT: 'cloneCount',
  FILES_IS_CLONE_FIELD: 'isClone',
  FILES_CLONED_AT_FIELD: 'clonedAt',
  FILES_FILES_FIELD: 'files',
  FILES_NFT_OWNER_FIELD: 'nftOwner',
  FILES_HAS_NFT_OWNER_FIELD: 'hnw',
  FILES_NFT_COLLECTION_FIELD: 'nftCollection',
  FILES_NFT_TOKEN_FIELD: 'nftToken',
  FILES_NFT_TOKEN_AMOUNT_FIELD: 'nftAmount',
  FILES_NFT_BLOCK_FIELD: 'nftBlock',
  FILES_HAS_REFERENCES_FIELD: 'hasReferences',
  FILES_REFERENCES_FIELD: 'references',
  FILES_IS_REFERENCED_FIELD: 'isReferenced',
  FILES_IS_IN_SHOWROOM_FIELD: 'isInShowroom',
  FILES_CATEGORIES_FIELD: 'categories',

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
    'c-masks': '.mask',
    'c-usdz': '.usdz',
  }, null),
  // errors
  FILE_MISSING_ERROR: new HttpStatusError(404, 'could not find associated data'),
  FILE_PROCESS_IN_PROGRESS_ERROR: new HttpStatusError(409, 'file is being processed'),
}, null);

exports.FILES_CAPABILITIES_FIELD = 'capabilities';
exports.FILES_DIMENSIONS_FIELD = 'dimensions';
exports.FILES_ARPROPS_FIELD = 'ar3dviewProps';
exports.FILES_CREATION_INFO_FIELD = 'creationInfo';
exports.FILES_PLAYER_SETTINGS_FIELD = 'playerSettings';
exports.FILES_PLAYER_FRAMES_CYCLE_FIELD = 'cycle';
exports.FILES_NFT_FIELD = 'nft';

exports.FIELDS_TO_STRINGIFY = [
  exports.FILES_TAGS_FIELD,
  exports.FILES_EXPORT_FIELD,
  exports.FILES_CONTROLS_FIELD,
  exports.FILES_CAPABILITIES_FIELD,
  exports.FILES_DIMENSIONS_FIELD,
  exports.FILES_ARPROPS_FIELD,
  exports.FILES_CREATION_INFO_FIELD,
  exports.FILES_PLAYER_SETTINGS_FIELD,
  exports.FILES_PLAYER_FRAMES_CYCLE_FIELD,
  exports.FILES_NFT_FIELD,
  exports.FILES_REFERENCES_FIELD,
];

exports.FIELDS_TO_UNTAG = {
  [exports.FILES_CATEGORIES_FIELD]: true,
};

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

exports.LOCK_UPDATE_KEY = (uploadId) => `file:update:${uploadId}`;
exports.LOCK_CLONE_KEY = (uploadId) => `file:clone:${uploadId}`;

exports.FILES_DATA_INDEX_KEY = (uploadId) => `${exports.FILES_DATA}:${uploadId}`;
exports.FILES_TAGS_INDEX_KEY = (tag) => `${exports.FILES_INDEX_TAGS}:${tag}`;
exports.FILES_USER_INDEX_KEY = (username) => `${exports.FILES_INDEX}:${username}`;
exports.FILES_USER_INDEX_PUBLIC_KEY = (username) => `${exports.FILES_INDEX}:${username}:pub`;
exports.FILES_USER_INDEX_UAT_KEY = (username) => `${exports.FILES_INDEX_UAT}:${username}`;
exports.FILES_USER_INDEX_UAT_PUBLIC_KEY = (username) => `${exports.FILES_USER_INDEX_UAT_KEY(username)}:pub`;
exports.FILES_REFERENCED_INDEX_KEY = (uploadId) => `${exports.FILES_INDEX_REFERENCED}:${uploadId}`;

exports.UPLOAD_TYPE_CLOUDFLARE_STREAM = 'cloudflare-stream';
exports.UPLOAD_TYPE_GLB_EXTENDED = 'glb-extended';
exports.UPLOAD_TYPE_PANORAMA_CUBEMAP = 'pano-cubemap';
exports.UPLOAD_TYPE_PANORAMA_EQUIRECT = 'pano-equirect';

exports.FILES_LIST_SEARCH = 'files-list-v11';

exports.TRANSPORT_NAME_GCE = 'gce';
exports.TRANSPORT_NAME_OSS = 'oss';
exports.TRANSPORT_NAME_CLOUDFLARE_STREAM = 'cloudflare-stream';
