const { HttpStatusError } = require('common-errors');

const {
  FILES_IMMUTABLE_FIELD,
  FILES_NFT_OWNER,
  FILES_NFT_TOKEN_AMOUNT,
  FILES_IS_CLONE_FIELD,
  FILES_NFT_BLOCK,
  FILES_IS_REFERENCED,
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
  FILES_NFT_TOKEN_AMOUNT,
  FILES_NFT_OWNER,
  FILES_NFT_BLOCK,
];

function fieldUpdatePossible(metaToUpdate) {
  const nonUpdatableFields = Object.entries(metaToUpdate).filter(([key]) => !updatableFields.includes(key));

  return nonUpdatableFields.length === 0;
}

function assertClonable(metaToUpdate) {
  return function isClonePossibleCheck(data) {
    if (!isImmutable(data) || !fieldUpdatePossible(metaToUpdate)) {
      throw new HttpStatusError(400, 'should be immutable object');
    }

    return data;
  };
}

function assertUpdatable(metaToUpdate = {}, isRemoveOp = false) {
  return function isUpdatePossibleCheck(data) {
    if (isImmutable(data) && !fieldUpdatePossible(metaToUpdate) && !isRemoveOp) {
      throw new HttpStatusError(400, 'should not be immutable object');
    }

    return data;
  };
}

async function assertNotReferenced(data) {
  if (data[FILES_IS_REFERENCED] === '1') {
    throw new HttpStatusError(400, 'should not be referenced');
  }

  return data;
}

module.exports = {
  isImmutable,
  isClone,
  assertImmutable,
  assertUpdatable,
  assertClonable,
  assertNotReferenced,
};
