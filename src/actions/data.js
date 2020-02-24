const { ActionTransport } = require('@microfleet/core');
const pick = require('lodash/pick');
const { FILES_DATA } = require('../constant');
const fetchData = require('../utils/fetch-data');


/**
 * File information
 * @param  {Object} params.fileId
 * @param  {Object} [params.fields]
 * @return {Promise}
 */
async function getFileData({ params }) {
  const { fileId, fields } = params;
  const file = await fetchData.call(this, `${FILES_DATA}:${fileId}`);
  await this.hook('files:info:post', file);
  return { file: pick(file, fields) };
}

getFileData.transports = [ActionTransport.amqp];
module.exports = getFileData;
