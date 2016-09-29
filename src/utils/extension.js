const { TYPE_MAP } = require('../constant.js');
const { extension } = require('mime-types');

/**
 * Returns extension based on predefined type or mime-type
 * @param  {String} type
 * @param  {String} contentType
 * @return {String}
 */
const typeToExtension = (type, contentType) =>
  TYPE_MAP[type] ||
  `.${extension(contentType)}` ||
  '.bin';

module.exports = typeToExtension;
