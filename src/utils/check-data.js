const { HttpStatusError } = require('common-errors');

const {
  FILES_IMMUTABLE_FIELD,
  FILES_NFT_OWNER_FIELD,
  FILES_NFT_TOKEN_AMOUNT_FIELD,
  FILES_IS_CLONE_FIELD,
  FILES_NFT_BLOCK_FIELD,
  FILES_IS_REFERENCED_FIELD,
  FILES_HAS_REFERENCES_FIELD,
  FILES_REFERENCES_FIELD,
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
  FILES_NFT_TOKEN_AMOUNT_FIELD,
  FILES_NFT_OWNER_FIELD,
  FILES_NFT_BLOCK_FIELD,
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
    if (isImmutable(data) && (!fieldUpdatePossible(metaToUpdate) || isRemoveOp)) {
      throw new HttpStatusError(400, 'should not be immutable object');
    }

    return data;
  };
}

function hasOrIsReference(data) {
  return data[FILES_HAS_REFERENCES_FIELD] === '1' || data[FILES_IS_REFERENCED_FIELD] === '1';
}

function assertReferenceOnAccessChange(metaToUpdate = {}, params = {}) {
  return function visibilityCheck(data) {
    if (((params.access && typeof params.access.setPublic === 'boolean') || typeof params.directOnly === 'boolean')
      && (
        hasOrIsReference(data) || (metaToUpdate[FILES_REFERENCES_FIELD] && metaToUpdate[FILES_REFERENCES_FIELD].length > 1)
      )
    ) {
      throw new HttpStatusError(400, 'should not have or be a reference');
    }

    return data;
  };
}

async function assertNotReferenced(data) {
  if (data[FILES_IS_REFERENCED_FIELD] === '1') {
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
  assertReferenceOnAccessChange,
};
