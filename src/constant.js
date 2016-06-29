module.exports = {
  STATUS_PENDING: '1',
  STATUS_UPLOADED: '2',
  STATUS_PROCESSED: '3',
  STATUS_PROCESSING: '4',
  STATUS_FAILED: '5',

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

  // type map
  TYPE_MAP: {
    'c-bin': '.bin.gz',
    'c-texture': '.jpeg',
    'c-preview': '.jpeg',
    'c-archive': '.zip',
  },
};
