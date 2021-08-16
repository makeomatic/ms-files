const is = require('is');
const { HttpStatusError } = require('common-errors');
const { STATUS_PROCESSED } = require('../constant');

module.exports = function isProcessed(data) {
  if (data.status && is.string(data.status) && parseInt(data.status, 10) < parseInt(STATUS_PROCESSED, 10)) {
    throw new HttpStatusError(412, 'your upload has not been processed yet');
  }

  return data;
};
