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

function assertNotImmutable(data) {
  if (isImmutable(data)) {
    throw new HttpStatusError(400, 'should not be immutable object');
  }

  return data;
}

module.exports = {
  isImmutable,
  assertImmutable,
  assertNotImmutable,
};
