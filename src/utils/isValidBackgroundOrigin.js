const { HttpStatusError } = require('common-errors');
const { FILES_BACKGROUND_IMAGE_FIELD } = require('../constant.js');
const find = require('lodash/find');

module.exports = function isValidBackgroundOrigin(data) {
  const backgroundImage = data[FILES_BACKGROUND_IMAGE_FIELD];

  if (backgroundImage) {
    const { url } = backgroundImage;
    const transports = this.config.transports;
    const origin = find(transports, transport => (
      url.includes(transport.options.bucket.name)
    ));

    if (!origin) {
      throw new HttpStatusError(412, 'invalid origin');
    }
  }

  return data;
};
