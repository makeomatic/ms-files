// This migrations adds created field for existing users
//
const fs = require('fs');

const {
  FILES_INDEX_PUBLIC,
  FILES_DATA,
} = require('../../constant');

const keys = [
  FILES_INDEX_PUBLIC,
  FILES_DATA,
];

const SCRIPT = fs.readFileSync(`${__dirname}/migrate.lua`, 'utf8');

// migration configuration
exports.min = 0;
exports.final = 1;

exports.script = (service) => {
  return service.redis.eval(SCRIPT, keys.length, keys);
};
