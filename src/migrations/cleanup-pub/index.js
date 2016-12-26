// This migrations adds created field for existing users
//
const fs = require('fs');
const Promise = require('bluebird');

const {
  FILES_INDEX_PUBLIC,
  FILES_DATA,
} = require('../../constant');

const SCRIPT = fs.readFileSync(`${__dirname}/migrate.lua`, 'utf8');

// migration configuration
exports.min = 0;
exports.final = 1;

exports.script = (service, pipeline, versionKey, appendLuaScript) => {
  const lua = appendLuaScript(exports.final, exports.min, SCRIPT);
  const keys = [
    versionKey,
    FILES_INDEX_PUBLIC,
    FILES_DATA,
  ];

  pipeline.eval(lua, keys.length, keys);

  return Promise.resolve(true);
};
