const { ActionTransport } = require('@microfleet/plugin-router');

const { FILES_DATA, FILES_ID_FIELD } = require('../constant');
const fetchData = require('../utils/fetch-data');

/**
 * File information
 * @param  {Object}   params.uploadId
 * @param  {String[]} [params.fields]
 * @return {Promise}
 */
async function getFileData({ params }) {
  const { uploadId, fields } = params;
  const fieldsToQuery = [FILES_ID_FIELD, ...fields];

  const file = await fetchData.call(this, `${FILES_DATA}:${uploadId}`, { pick: fieldsToQuery });

  return { file };
}

getFileData.transports = [ActionTransport.amqp];
module.exports = getFileData;
