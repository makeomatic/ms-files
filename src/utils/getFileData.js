const { HttpStatusError } = require('common-errors');

module.exports = function getFileData(key) {
  const { redis } = this;
  return redis
    .pipeline()
    .exists(key)
    .hmget(key, 'owner', 'status')
    .exec()
    .spread((fileExistsResponse, dataResponse) => {
      const fileExists = fileExistsResponse[1];
      const data = dataResponse[1];

      if (!fileExists) {
        throw new HttpStatusError(404, 'could not find associated data');
      }

      return {
        owner: data[0],
        status: data[1]
      };
    });
};
