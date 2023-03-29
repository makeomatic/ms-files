const { HttpStatusError } = require('common-errors');

const {
  FILES_IMMUTABLE_FIELD,
  FILES_NFT_OWNER,
  FILES_NFT_AMOUNT,
  FILES_IS_CLONE_FIELD,
} = require('../constant');

function isImmutable(data) {
  return data && data[FILES_IMMUTABLE_FIELD];
}

function isClone(data) {
  return data && data[FILES_IS_CLONE_FIELD];
}

function assertImmutable(data) {
  if (!isImmutable(data)) {
    throw new HttpStatusError(400, 'should be immutable object');
  }

  return data;
}

const updatableFields = [
  FILES_NFT_AMOUNT,
  FILES_NFT_OWNER,
];

function assertUpdatable(metaToUpdate = {}, isRemoveOp = false) {
  return function isPossibleUpdateCheck(data) {
    const updatesRoField = Object.entries(metaToUpdate).filter(([key]) => !(updatableFields.includes(key)));

    if (isImmutable(data) && !updatesRoField && !isRemoveOp) {
      throw new HttpStatusError(400, 'should not be immutable object');
    }

    return data;
  };
}

module.exports = {
  isImmutable,
  isClone,
  assertImmutable,
  assertUpdatable,
};
