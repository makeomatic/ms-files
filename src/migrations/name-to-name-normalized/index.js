const handlePipeline = require('../../utils/pipeline-error');
const { normalizeForSearch } = require('../../utils/normalize-name');
const {
  FILES_INDEX,
  FILES_DATA_INDEX_KEY,
  FILES_NAME_FIELD,
  FILES_NAME_NORMALIZED_FIELD,
} = require('../../constant');

async function nameToNameNormalized(service) {
  const { redis: masterNode, log } = service;
  let iter = 0;

  const stream = masterNode.sscanStream(FILES_INDEX, {
    count: 100,
  });

  for await (const ids of stream) {
    iter += 1;
    log.info({ iteration: iter, num: ids.length }, 'retrieved batch of ids');

    const data = await masterNode.pipeline(
      ids.map((id) => (
        ['hmget', FILES_DATA_INDEX_KEY(id), FILES_NAME_FIELD]
      ))
    ).exec();

    log.info({ iteration: iter }, 'retrieved meta information');

    const addFieldPipeline = masterNode.pipeline();

    for (const [idx, [name]] of handlePipeline(data).entries()) {
      const uploadId = ids[idx];
      addFieldPipeline.hset(FILES_DATA_INDEX_KEY(uploadId), FILES_NAME_NORMALIZED_FIELD, normalizeForSearch(name));
    }

    handlePipeline(await addFieldPipeline.exec());

    log.info({ iteration: iter }, 'processed batch');
  }

  log.info('finished nameToNameNormalized processing in %d iterations', iter);
}

module.exports = {
  script: nameToNameNormalized,
  min: 12,
  final: 13,
};
