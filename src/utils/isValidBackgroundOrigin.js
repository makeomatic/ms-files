const { HttpStatusError } = require('common-errors');
const { FILES_BACKGROUND_IMAGE_FIELD } = require('../constant.js');

module.exports = function isValidBackgroundOrigin(data) {
  const backgroundImage = data[FILES_BACKGROUND_IMAGE_FIELD];

  if (backgroundImage) {
    const { url } = backgroundImage;
    const provider = this.provider('update');
    const isValidOrigin = url.indexOf(provider.cname) === 0;

    if (!isValidOrigin) {
      throw new HttpStatusError(412, 'invalid origin');
    }
  }

  return data;
};
