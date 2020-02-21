const { ActionTransport } = require('@microfleet/core');
const assert = require('assert');
const { NotImplementedError, HttpStatusError } = require('common-errors');
const { FILES_DATA, FILES_OWNER_FIELD } = require('../constant');
const fetchData = require('../utils/fetch-data');
const resolveFilename = require('../utils/resolve-filename');

/**
 * File information
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
async function getFileInfo({ params }) {
  const { filename: possibleFilename, username: owner } = params;
  const skipOwnerCheck = typeof params.skipOwnerCheck === 'boolean' ? params.skipOwnerCheck : false;

  const [username] = await this.hook('files:info:pre', owner);

  if (!skipOwnerCheck) {
    assert(username, new NotImplementedError('files:info:pre hook must be specified to use this endpoint'));
  }

  const filename = await resolveFilename.call(this, possibleFilename, username);
  const file = await fetchData.call(this, `${FILES_DATA}:${filename}`);

  if (!skipOwnerCheck) {
    // check that owner is a match
    // even in-case with public we want the user to specify username
    if (file[FILES_OWNER_FIELD] !== username) {
      throw new HttpStatusError(401, 'please sign as an owner of this model to access it');
    }
    // rewire owner to requested username
    file.owner = owner;
  }

  await this.hook('files:info:post', file);

  return { username, file };
}

getFileInfo.transports = [ActionTransport.amqp];
module.exports = getFileInfo;
