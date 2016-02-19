const { HttpStatusError } = require('common-errors');

module.exports = function exists(key) {
  const { redis } = this;
  return redis
    .pipeline()
    .exists(key)
    .hgetall(key)
    .exec()
    .spread((fileExistsResponse, dataResponse) => {
      const fileExists = fileExistsResponse[1];
      const data = dataResponse[1];

      if (!fileExists) {
        throw new HttpStatusError(404, 'could not find associated data');
      }

      return data;
    });
};
