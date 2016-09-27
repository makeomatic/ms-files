const findIndex = require('lodash/findIndex');

const PROPS_TO_ADD = ['model', 'obj', 'wrl', 'stl'];

/**
 * Decorates output with extra data to ease fetching of links
 */
module.exports = function decorateOutput(originalData, output) {
  const files = output.files;

  PROPS_TO_ADD.forEach((prop) => {
    const nonResolvedLink = originalData[prop];
    if (nonResolvedLink) {
      const idx = findIndex(files, { filename: nonResolvedLink });
      output[prop] = output.urls[idx];
    }
  });
};
