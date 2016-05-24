const fs = require('fs');

module.exports = function getEmbeddedInfo(info) {
  const { uploadId: id } = info;

  const code = fs.readFileSync('src/utils/embeddedCode.hbs').toString();

  return {
    code,
    params: {
      id,
      autorun: 0,
      width: 800,
      height: 800,
    },
  };
};
