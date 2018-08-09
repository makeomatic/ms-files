const { extension } = require('mime-types');
const { TYPE_MAP } = require('../constant');

/**
 * Returns extension based on predefined type or mime-type
 * @param  {String} type
 * @param  {String} contentType
 * @return {String}
 */
const typeToExtension = (type, contentType) => TYPE_MAP[type]
  || extension(contentType).replace(/^([^.]{1}.*)$/, '.$1')
  || '.bin';

module.exports = typeToExtension;
