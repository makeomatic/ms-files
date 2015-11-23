const Errors = require('common-errors');

/**
 * List files
 * @return {Promise}
 */
module.exports = function postProcessFile() {
  return Promise.reject(new Errors.HttpStatusError(501, 'not implemented'));
};
