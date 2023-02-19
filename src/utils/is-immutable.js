const { HttpStatusError } = require('common-errors');

const { FILES_IMMUTABLE_FIELD } = require('../constant');

function isImmutable(data) {
  return data && data[FILES_IMMUTABLE_FIELD];
}

function assertImmutable(data) {
  if (!isImmutable(data)) {
    throw new HttpStatusError(400, 'should be immutable object');
  }

  return data;
}

function assertNotImmutable(metaToUpdate = {}) {
  const allowedFieldsRe = /^c_nft.+/;

  return function immutabilityCheck(data) {
    const roField = Object.entries(metaToUpdate).filter(([key]) => !(allowedFieldsRe.test(key)));

    if (isImmutable(data) && !roField) {
      throw new HttpStatusError(400, 'should not be immutable object');
    }

    return data;
  };
}

module.exports = {
  isImmutable,
  assertImmutable,
  assertNotImmutable,
};
