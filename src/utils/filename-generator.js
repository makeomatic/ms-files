const { basename } = require('path');

const ExtReplacer = /^[^.]+\.(.*)$/;
const getExtension = (name) => basename(name).replace(ExtReplacer, '$1');

class Filenames {
  constructor(name) {
    this.name = name;
    this.counter = [];
  }

  next(filename) {
    const { counter, name } = this;
    const originalExt = getExtension(filename);

    // NOTE: safari filename fix for ignoring content-type
    // when content-disposition is set
    const ext = originalExt === 'bin.gz'
      ? 'txt'
      : originalExt;
    const val = (counter[ext] || 0) + 1;

    counter[ext] = val;

    return `${name}_${val}.${ext}`;
  }
}

module.exports = Filenames;
