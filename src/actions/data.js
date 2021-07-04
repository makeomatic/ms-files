const { ActionTransport } = require('@microfleet/core');

const { FILES_DATA } = require('../constant');
const fetchData = require('../utils/fetch-data');

/**
 * File information
 * @param  {Object}   params.uploadId
 * @param  {String[]} [params.fields]
 * @return {Promise}
 */
async function getFileData({ params }) {
  const { uploadId, fields } = params;
  const fieldsToQuery = ['uploadId', ...fields];

  const file = await fetchData.call(this, `${FILES_DATA}:${uploadId}`, { pick: fieldsToQuery });

  return { file };
}

getFileData.transports = [ActionTransport.amqp];
module.exports = getFileData;
