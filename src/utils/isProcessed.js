const { HttpStatusError } = require('common-errors');
const { STATUS_PROCESSED } = require('../constant.js');

module.exports = function isProcessed(data) {
  if (data.status !== STATUS_PROCESSED) {
    throw new HttpStatusError(412, 'your upload has not been processed yet');
  }

  return data;
};
