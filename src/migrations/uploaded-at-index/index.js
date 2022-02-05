const { getRedisMasterNode } = require('../../utils/get-redis-master-node');
const handlePipeline = require('../../utils/pipeline-error');
const {
  FILES_INDEX,
  FILES_DATA_INDEX_KEY,
  FILES_UPLOADED_AT_FIELD,
  FILES_OWNER_FIELD,
  FILES_PUBLIC_FIELD,
  FILES_DIRECT_ONLY_FIELD,
  FILES_INDEX_UAT,
  FILES_INDEX_UAT_PUBLIC,
  FILES_USER_INDEX_UAT_KEY,
  FILES_USER_INDEX_UAT_PUBLIC_KEY,
} = require('../../constant');

async function uploadedIndexAt(service) {
  const { redis, config, log } = service;
  const masterNode = getRedisMasterNode(redis, config);

  let iter = 0;
  const stream = masterNode.sscanStream(FILES_INDEX, {
    count: 100,
  });

  // retrieves 100 ids and works on them
  for await (const ids of stream) {
    iter += 1;
    log.info({ iteration: iter, num: ids.length }, 'retrieved batch of ids');

    const data = await masterNode.pipeline(ids.map((id) => (
      ['hmget', FILES_DATA_INDEX_KEY(id), FILES_UPLOADED_AT_FIELD, FILES_OWNER_FIELD, FILES_PUBLIC_FIELD, FILES_DIRECT_ONLY_FIELD]
    ))).exec();

    log.info({ iteration: iter }, 'retrieved meta information');

    const addDataPipe = masterNode.pipeline();
    for (const [idx, [uat, owner, pub, direct]] of handlePipeline(data).entries()) {
      const uploadId = ids[idx];

      addDataPipe.zadd(FILES_INDEX_UAT, uat, uploadId);
      addDataPipe.zadd(FILES_USER_INDEX_UAT_KEY(owner), uat, uploadId);

      if (pub && !direct) {
        addDataPipe.zadd(FILES_INDEX_UAT_PUBLIC, uat, uploadId);
        addDataPipe.zadd(FILES_USER_INDEX_UAT_PUBLIC_KEY(owner), uat, uploadId);
      }
    }

    handlePipeline(await addDataPipe.exec());

    log.info({ iteration: iter }, 'processed batch');
  }

  log.info('finished uploadedIndexAt processing in %d iterations', iter);
}

module.exports = {
  script: uploadedIndexAt,
  min: 3,
  final: 4,
};
