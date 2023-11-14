const { ValidationError } = require('common-errors');
const { isEqual, chunk } = require('lodash');

const {
  FILES_REFERENCES_FIELD,
  FILES_REFERENCED_INDEX_KEY,
  FILES_DATA_INDEX_KEY,
  FILES_OWNER_FIELD,
  FILES_IS_REFERENCED_FIELD,
  FILES_HAS_REFERENCES_FIELD,
  FILES_HAS_NFT,
  FILES_IMMUTABLE_FIELD,
  FILE_MISSING_ERROR,
  FILES_DIRECT_ONLY_FIELD,
  FILES_UNLISTED_FIELD,
  FILES_IS_IN_SHOWROOM_FIELD,
  FILES_STATUS_FIELD,
  FILES_PUBLIC_FIELD,
  STATUS_PROCESSED,
} = require('../constant');
const handlePipeline = require('./pipeline-error');

const findDeleted = (oldReferences, newReferences) => oldReferences.filter((id) => !newReferences.includes(id));
const findAdded = (oldReferences, newReferences) => newReferences.filter((id) => !oldReferences.includes(id));

function isReferenceChanged(newMeta, originalMeta) {
  return !isEqual(newMeta[FILES_REFERENCES_FIELD], originalMeta[FILES_REFERENCES_FIELD]);
}

async function getReferenceData(redis, references = []) {
  const pipeline = redis.pipeline();

  references.forEach((id) => {
    pipeline.smembers(FILES_REFERENCED_INDEX_KEY(id));
    pipeline.hmget(
      FILES_DATA_INDEX_KEY(id),
      FILES_OWNER_FIELD,
      FILES_HAS_REFERENCES_FIELD,
      FILES_HAS_NFT,
      FILES_IMMUTABLE_FIELD,
      FILES_DIRECT_ONLY_FIELD,
      FILES_UNLISTED_FIELD,
      FILES_PUBLIC_FIELD,
      FILES_STATUS_FIELD,
      FILES_IS_IN_SHOWROOM_FIELD
    );
  });

  const redisData = handlePipeline(await pipeline.exec());
  const referenceInfoMap = {};

  chunk(redisData, 2).forEach(([referenced, meta], index) => {
    const [owner, hasReferences, hasNft, immutable, directOnly, unlisted, publicField, status] = meta;
    if (!owner) {
      throw FILE_MISSING_ERROR;
    }

    const refUploadId = references[index];
    referenceInfoMap[refUploadId] = {
      hasNft,
      hasReferences,
      referenced,
      owner,
      immutable,
      directOnly,
      unlisted,
      status,
      public: publicField,
    };
  });

  return referenceInfoMap;
}

function verifyReferences(originalMeta, referenceInfoMap, newReferences) {
  const { uploadId, owner } = originalMeta;
  const oldReferences = originalMeta[FILES_REFERENCES_FIELD] || [];
  const added = findAdded(oldReferences, newReferences);

  // :(
  const validationError = new ValidationError('invalid reference');
  validationError.statusCode = 403;

  added.forEach((id) => {
    const refInfo = referenceInfoMap[id];

    if (refInfo.status !== STATUS_PROCESSED) {
      validationError.addError(
        new ValidationError('invalid reference status', 'e_reference', id)
      );
    }

    if (refInfo.owner !== owner) {
      validationError.addError(
        new ValidationError('invalid reference owner', 'e_reference', id)
      );
    }

    if (refInfo.hasReferences && refInfo.hasReferences === '1') {
      validationError.addError(
        new ValidationError('should not have child references', 'e_reference', id)
      );
    }

    if (refInfo.hasNft) {
      validationError.addError(
        new ValidationError('should not be special type', 'e_reference', id)
      );
    }

    if (refInfo.immutable) {
      validationError.addError(
        new ValidationError('should not be immutable', 'e_reference', id)
      );
    }

    if (refInfo.directOnly || refInfo.unlisted || !refInfo.public) {
      validationError.addError(
        new ValidationError('should not be private or unlisted', 'e_reference', id)
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

function updateReferences(newMeta, originalMeta, referencedInfo, pipeline) {
  const oldReferences = originalMeta[FILES_REFERENCES_FIELD] || [];
  const newReferences = newMeta[FILES_REFERENCES_FIELD] || [];

  const deleted = findDeleted(oldReferences, newReferences);
  const added = findAdded(oldReferences, newReferences);

  added.forEach((id) => {
    pipeline.hset(FILES_DATA_INDEX_KEY(id), FILES_IS_REFERENCED_FIELD, '1');
    pipeline.sadd(FILES_REFERENCED_INDEX_KEY(id), originalMeta.uploadId);
  });

  deleted.forEach((id) => {
    if (referencedInfo[id].referenced.length - 1 === 0) {
      pipeline.hdel(FILES_DATA_INDEX_KEY(id), FILES_IS_REFERENCED_FIELD);
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
