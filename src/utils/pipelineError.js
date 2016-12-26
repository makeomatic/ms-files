const { RedisError } = require('common-errors').data;

/**
 * Handles ioredis pipeline.exec() error
 */
module.exports = function handlePipelineError(args) {
  const errors = [];
  const length = args.length;
  const response = new Array(length);

  for (let i = 0; i < length; i += 1) {
    const [err, res] = args[i];

    // collect errors
    if (err) errors.push(err);

    // collect responses
    response[i] = res;
  }

  if (errors.length > 0) {
    const message = errors.map(err => err.message).join('; ');
    throw new RedisError(message);
  }

  return response;
};
