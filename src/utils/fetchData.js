const { HttpStatusError } = require('common-errors');

module.exports = function exists(key) {
  const { redis } = this;
  return redis
    .pipeline()
    .exists(key)
    .hgetallBuffer(key)
    .exec()
    .spread((fileExistsResponse, dataResponse) => {
      const fileExists = fileExistsResponse[1];
      const data = dataResponse[1];

      for (key in data) {
        if (key === 'tags') {
          data[key] = data[key].toJSON();
        } else {
          data[key] = data[key].toString('utf8');
        }
      }

      if (!fileExists) {
        throw new HttpStatusError(404, 'could not find associated data');
      }

      return data;
    });
};
