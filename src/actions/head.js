const { ActionTransport } = require('@microfleet/core');
const { HttpStatusError } = require('common-errors');
const { FILES_USR_ALIAS_PTR } = require('../constant');
const handlePipeline = require('../utils/pipelineError');

async function headAction({ params }) {
  const { aliases, username } = params;
  const hash = `${FILES_USR_ALIAS_PTR}:${username}`;

  const [exists, response] = await this.redis
    .pipeline([
      ['exists', hash],
      ['hmget', hash, aliases],
    ])
    .exec()
    .then(handlePipeline);

  if (exists === 0) {
    throw new HttpStatusError(404, "there aren't any files");
  }

  return response;
}

headAction.transports = [ActionTransport.amqp];

module.exports = headAction;
