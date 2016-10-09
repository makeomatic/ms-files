const intersectionBy = require('lodash/intersectionBy');
const lowerCase = require('lodash/lowerCase');
const { TYPE_MAP } = require('../constant');

const CAPPASITY_FILES = Object.keys(TYPE_MAP);

module.exports = function isCappasityUpload(types) {
  const cappasityFiles = intersectionBy(types, CAPPASITY_FILES, lowerCase);

  return cappasityFiles.length > 0;
};
