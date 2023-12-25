const { HttpStatusError } = require('common-errors');

const {
  FILES_IMMUTABLE_FIELD,
  FILES_IS_CLONE_FIELD,
  FILES_IS_REFERENCED_FIELD,
  FILES_HAS_REFERENCES_FIELD,
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

const updatableFields = [];

const nonRemoveableFields = [
  ...updatableFields,
];

function fieldUpdatePossible(metaToUpdate) {
  const nonUpdatableFields = Object.entries(metaToUpdate).filter(([key]) => !updatableFields.includes(key));

  return nonUpdatableFields.length === 0;
}

function fieldRemovePossible(metaToRemove = []) {
  const nonRemovableFields = metaToRemove.filter((key) => !nonRemoveableFields.includes(key));

  return nonRemovableFields.length === 0;
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

function assertRemovable(metaToRemove = []) {
  return function isRemovePossibleCheck(data) {
    assertImmutable(data);

    if (!fieldRemovePossible(metaToRemove)) {
      throw new HttpStatusError(400, 'meta fields can not be removed');
    }

    return data;
  };
}

function hasOrIsReference(data) {
  return data[FILES_HAS_REFERENCES_FIELD] === '1' || data[FILES_IS_REFERENCED_FIELD] === '1';
}

function assertNotReferenced() {
  return function hasReferencesCheck(data) {
    if (hasOrIsReference(data)) {
      throw new HttpStatusError(400, 'should not be referenced');
    }

    return data;
  };
}

module.exports = {
  isImmutable,
  isClone,
  assertImmutable,
  assertUpdatable,
  assertClonable,
  assertNotReferenced,
  assertRemovable,
};
