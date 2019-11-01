const { HttpStatusError } = require('common-errors');
const { FILES_BACKGROUND_IMAGE_FIELD } = require('../constant.js');

const MD5_RE = '[0-9A-Fa-f]{32}';
const UUID_RE = '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}';
const FORMATS_RE = '(?:png|jpeg|jpg)';
const FILENAME_RE = `${MD5_RE}/${UUID_RE}/${UUID_RE}\\.${FORMATS_RE}`;

module.exports = function isValidBackgroundOrigin(data) {
  const backgroundImage = data[FILES_BACKGROUND_IMAGE_FIELD];

  if (backgroundImage) {
    const url = decodeURIComponent(backgroundImage);

    /**
     *  Using 'upload' selector here since background images are always
     *  contained in the persistent store
     *  https://github.com/makeomatic/ms-files/blob/master/src/custom/cappasity-select-bucket.js#L10
     */
    const cname = this.provider('upload', data).cname.replace(/\./g, '\\.');
    const pattern = new RegExp(`^${cname}/${FILENAME_RE}$`);
    const isValidOrigin = url.match(pattern);

    if (!isValidOrigin) {
      throw new HttpStatusError(412, 'invalid origin');
    }
  }

  return data;
};
