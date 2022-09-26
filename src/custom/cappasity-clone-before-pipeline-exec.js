const { FILES_DATA_INDEX_KEY } = require('../constant');

const FILES_NFT_CHILD_COUNT_FIELD = 'nftCount';

module.exports = async function clonePost(pipeline, uploadData) {
  if (uploadData.nft) {
    const parentUploadKey = FILES_DATA_INDEX_KEY(uploadData.parentId);
    pipeline.hincrby(parentUploadKey, FILES_NFT_CHILD_COUNT_FIELD, 1);
  }
};
