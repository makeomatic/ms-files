const conf = require('ms-conf');
const path = require('path');

conf.prependDefaultConfiguration(path.resolve(__dirname, './configs'));

module.exports = conf;
