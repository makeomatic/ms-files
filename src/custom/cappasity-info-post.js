const fs = require('fs');
const embeddedCodeFilePath = process.env.NODE_ENV === 'development'
  ? 'src/utils/embeddedCode.hbs'
  : '/src/lib/utils/embeddedCode.hbs';

const code = fs.readFileSync(embeddedCodeFilePath).toString();

module.exports = function getEmbeddedInfo(data) {
  const { uploadId: id } = data.file;

  data.file.embed = {
    code,
    params: {
      id,
      autorun: 0,
      width: 800,
      height: 800,
    },
  };

  return data;
};
