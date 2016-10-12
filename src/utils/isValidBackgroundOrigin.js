const { HttpStatusError } = require('common-errors');
const { FILES_BACKGROUND_IMAGE_FIELD } = require('../constant.js');

module.exports = function isValidBackgroundOrigin(data) {
  const backgroundImage = data[FILES_BACKGROUND_IMAGE_FIELD];

  if (backgroundImage) {
    /**
     *  Using 'upload' selector here since background images are always
     *  contained in the persistent store
     *  https://github.com/makeomatic/ms-files/blob/master/src/custom/cappasity-select-bucket.js#L10
     */
    const provider = this.provider('upload', data);
    const isValidOrigin = backgroundImage.match(`^${provider.cname}(.*)\.(png|jpeg|jpg)$`);

    if (!isValidOrigin) {
      throw new HttpStatusError(412, 'invalid origin');
    }
  }

  return data;
};
