const { extension } = require('mime-types');
const { TYPE_MAP } = require('../constant');

/**
 * Returns extension based on predefined type or mime-type
 * @param  {String} type
 * @param  {String} contentType
 * @return {String}
 */
const exp = /^([^.]{1}.*)$/;
const cpack = (type) => (type.startsWith('c-pack') ? '.pack' : false);
const typeToExtension = (type, contentType) => TYPE_MAP[type]
  || cpack(type)
  || (extension(contentType) || '').replace(exp, '.$1')
  || '.bin';

module.exports = typeToExtension;
