const { ValidationError } = require('common-errors');
const { isEqual, chunk } = require('lodash');

const {
  FILES_REFERENCE_FIELD,
  FILES_REFERENCED_INDEX_KEY,
  FILES_DATA_INDEX_KEY,
  FILES_OWNER_FIELD,
  FILES_IS_REFERENCED,
} = require('../constant');
const handlePipeline = require('./pipeline-error');

const findDeleted = (oldReferences, newReferences) => oldReferences.filter((id) => !newReferences.includes(id));
const findAdded = (oldReferences, newReferences) => newReferences.filter((id) => !oldReferences.includes(id));

function isReferenceChanged(newMeta, originalMeta) {
  return isEqual(newMeta[FILES_REFERENCE_FIELD], originalMeta[FILES_REFERENCE_FIELD]);
}

async function getReferenceData(redis, references = []) {
  const pipeline = redis.pipeline();

  references.forEach((id) => {
    pipeline.smembers(FILES_REFERENCED_INDEX_KEY(id));
    pipeline.hget(FILES_DATA_INDEX_KEY(id), FILES_OWNER_FIELD);
  });

  const redisData = handlePipeline(await pipeline.exec());
  const referenceInfoMap = {};

  chunk(redisData, 2).forEach(([referenced, owner], index) => {
    const refUploadId = references[index];
    referenceInfoMap[refUploadId] = {
      referenced,
      owner,
    };
  });

  return referenceInfoMap;
}

function verifyReferences(originalMeta, referenceInfoMap, newReferences) {
  const { uploadId, owner } = originalMeta;
  const oldReferences = originalMeta[FILES_REFERENCE_FIELD] || [];
  const added = findAdded(oldReferences, newReferences);
  const validationError = new ValidationError();

  added.forEach((id) => {
    const refInfo = referenceInfoMap[id];
    if (refInfo.owner !== owner) {
      validationError.addError(
        new ValidationError('invalid reference owner', 'e_reference', id)
      );
    }

    const { referenced } = refInfo;
    if (Array.isArray(referenced) && ((referenced.length === 1 && !referenced.includes(uploadId)) || referenced.length > 1)) {
      validationError.addError(
        new ValidationError('already has reference', 'e_reference', id)
      );
    }
  });

  if (validationError.errors) {
    throw validationError;
  }
}

async function updateReferences(newMeta, originalMeta, referencedInfo, pipeline) {
  const oldReferences = originalMeta[FILES_REFERENCE_FIELD] || [];
  const newReferences = newMeta[FILES_REFERENCE_FIELD] || [];

  const deleted = findDeleted(oldReferences, newReferences);
  const added = findAdded(oldReferences, newReferences);

  added.forEach((id) => {
    pipeline.hset(FILES_DATA_INDEX_KEY(id), FILES_IS_REFERENCED, '1');
    pipeline.sadd(FILES_REFERENCED_INDEX_KEY(id), originalMeta.uploadId);
  });

  deleted.forEach((id) => {
    if (referencedInfo[id].referenced.length - 1 === 0) {
      pipeline.hset(FILES_DATA_INDEX_KEY(id), FILES_IS_REFERENCED, '0');
    }
    pipeline.srem(FILES_REFERENCED_INDEX_KEY(id), originalMeta.uploadId);
  });
}

module.exports = {
  verifyReferences,
  updateReferences,
  isReferenceChanged,
  getReferenceData,
};
