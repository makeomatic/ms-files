const {
  FILES_DATA,
  FILES_ALIAS_FIELD,
  FILES_OWNER_FIELD,
  FILES_PUBLIC_FIELD,
  FILES_PACKED_FIELD,
  FILES_TAGS_FIELD,
  FILES_TEMP_FIELD,
  FILES_STATUS_FIELD,
  FILES_PARTS_FIELD,
  FILES_UNLISTED_FIELD,
  FILES_DIRECT_ONLY_FIELD,
  FILES_UPLOADED_AT_FIELD,
  FILES_ID_FIELD,
  FILES_UPLOAD_STARTED_AT_FIELD,
  FILES_CONTENT_LENGTH_FIELD,
  FILES_HAS_NFT,
} = require('../../constant');

const FIELD_TO_TYPE = [
  [FILES_ID_FIELD, 'TAG', 'SORTABLE'],
  [FILES_ALIAS_FIELD, 'AS', 'alias_text', 'TEXT', 'SORTABLE'],
  [FILES_ALIAS_FIELD, 'TAG', 'SORTABLE'],
  [FILES_OWNER_FIELD, 'TAG', 'SORTABLE'],
  [FILES_PUBLIC_FIELD, 'TAG', 'SORTABLE'],
  [FILES_PACKED_FIELD, 'TAG', 'SORTABLE'],
  [FILES_TAGS_FIELD, 'TEXT', 'SORTABLE'],
  [FILES_STATUS_FIELD, 'NUMERIC', 'SORTABLE'],
  [FILES_PARTS_FIELD, 'NUMERIC', 'SORTABLE'],
  [FILES_UNLISTED_FIELD, 'NUMERIC', 'SORTABLE'],
  [FILES_DIRECT_ONLY_FIELD, 'NUMERIC', 'SORTABLE'],
  [FILES_UPLOADED_AT_FIELD, 'NUMERIC', 'SORTABLE'],
  [FILES_UPLOAD_STARTED_AT_FIELD, 'NUMERIC', 'SORTABLE'],
  [FILES_CONTENT_LENGTH_FIELD, 'NUMERIC', 'SORTABLE'],
  [FILES_HAS_NFT, 'NUMERIC', 'SORTABLE'],
  [FILES_TEMP_FIELD, 'NUMERIC', 'SORTABLE'],
];

// https://redis.io/docs/stack/search/reference/aggregations/#filter-expressions
async function createSearchIndex(service) {
  const { redis, config } = service;
  const { keyPrefix } = config.redis.options;

  await redis.call(
    'FT.CREATE',
    `${keyPrefix}:files-list`,
    'ON',
    'HASH',
    'PREFIX',
    '1',
    `${keyPrefix}${FILES_DATA}:`,
    'FILTER',
    `@${FILES_TEMP_FIELD} != 1`,
    'SCHEMA',
    ...FIELD_TO_TYPE.flatMap((x) => x)
  );
}

module.exports = {
  script: createSearchIndex,
  min: 1,
  final: 5,
};
