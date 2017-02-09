const { FILES_USR_ALIAS_PTR } = require('../constant.js');
const handlePipeline = require('../utils/pipelineError');
const { HttpStatusError } = require('common-errors');

function headAction({ params }) {
  const { aliases, username } = params;
  const hash = `${FILES_USR_ALIAS_PTR}:${username}`;

  return this.redis
    .pipeline()
    .exists(hash)
    .hmget(hash, aliases)
    .exec()
    .then(handlePipeline)
    .spread((exists, response) => {
      if (exists === 0) {
        throw new HttpStatusError(404, "there aren't any files");
      }

      return response;
    });
}

module.exports = headAction;
