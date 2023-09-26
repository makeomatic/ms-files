const { extension } = require('mime-types');
const { TYPE_MAP } = require('../constant');

/**
 * Returns extension based on predefined type or mime-type
 * @param  {String} type
 * @param  {String} contentType
 * @return {String}
 */
const exp = /^([^.]{1}.*)$/;
const mimeExt = (contentType) => (extension(contentType) || '').replace(exp, '.$1');
const cpack = (type) => (type.startsWith('c-pack') ? '.pack' : false);
const typeToExtension = (type, contentType) => {
  if (type === 'c-preview') {
    return mimeExt(contentType) || TYPE_MAP[type];
  }

  return TYPE_MAP[type]
    || cpack(type)
    || mimeExt(contentType)
    || '.bin';
};

module.exports = typeToExtension;
