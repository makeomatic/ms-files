const path = require('path');
const auditLog = require('../utils/audit-log');

exports.router = {
  routes: {
    directory: path.resolve(__dirname, '../actions'),
    prefix: 'files',
    enabledGenericActions: ['health'],
  },
  extensions: {
    register: [auditLog],
  },
};
