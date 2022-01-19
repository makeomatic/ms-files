const path = require('path');
const { Extensions: { auditLog } } = require('@microfleet/plugin-router');

exports.router = {
  routes: {
    directory: path.resolve(__dirname, '../actions'),
    prefix: 'files',
    enabledGenericActions: [
      'health',
    ],
  },
  extensions: {
    register: [auditLog()],
  },
};
