const moment = require('moment');
const { STATUS_UPLOADED, FILES_OWNER_FIELD } = require('./constant');

/**
 * Invoke this method to start post-processing of all pending files
 */
module.exports = async function postProcess(offset = 0, uploadedAt = moment().subtract(1, 'hour').valueOf()) {
  const filter = {
    status: {
      eq: STATUS_UPLOADED,
    },
    uploadedAt: {
      lte: uploadedAt,
      gte: uploadedAt - this.config.listMaxInterval,
    },
  };

  const data = await this.dispatch('list', { params: { filter, limit: 20, offset } });
  const { files, cursor, page, pages } = data;

  for (const file of files.values()) {
    const params = {
      uploadId: file.id,
      username: file[FILES_OWNER_FIELD],
    };
    try {
      // eslint-disable-next-line no-await-in-loop
      await this.dispatch('process', { params });
      this.log.info(params, '% processed', file.id);
    } catch (err) {
      this.log.warn({ err, ...params }, '%s failed to process', file.id);
    }
  }

  if (page < pages) {
    return postProcess.call(this, cursor, filter.uploadedAt.lte);
  }

  this.log.info('completed files post-processing');
  return null;
};
