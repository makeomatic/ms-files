const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const assert = require('assert');
const { NotImplementedError, HttpStatusError } = require('common-errors');
const { FILES_DATA, FILES_OWNER_FIELD } = require('../constant');
const fetchData = require('../utils/fetchData');
const resolveFilename = require('../utils/resolveFilename');

const NOT_IMPLEMENTED_ERROR = new NotImplementedError('files:info:pre hook must be specified to use this endpoint');

/**
 * File information
 * @param  {Object} opts.filename
 * @param  {Object} opts.username
 * @return {Promise}
 */
async function getFileInfo({ params }) {
  const { filename: possibleFilename, username: owner } = params;

  const [username] = await Promise
    .bind(this, ['files:info:pre', owner])
    .spread(this.hook);

  assert(username, NOT_IMPLEMENTED_ERROR);

  const filename = await Promise
    .bind(this, [possibleFilename, username])
    .spread(resolveFilename);

  const file = await Promise
    .bind(this, `${FILES_DATA}:${filename}`)
    .then(fetchData);

  // check that owner is a match
  // even in-case with public we want the user to specify username
  if (file[FILES_OWNER_FIELD] !== username) {
    throw new HttpStatusError(401, 'please sign as an owner of this model to access it');
  }

  // rewire owner to requested username
  file.owner = owner;

  await Promise
    .bind(this, ['files:info:post', file])
    .spread(this.hook);

  return { username, file };
}

getFileInfo.transports = [ActionTransport.amqp];
module.exports = getFileInfo;
