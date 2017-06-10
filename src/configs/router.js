const path = require('path');
const routerExtension = require('@microfleet/core').routerExtension;

const autoSchema = routerExtension('validate/schemaLessAction');
const auditLog = routerExtension('audit/log');

exports.router = {
  routes: {
    directory: path.resolve(__dirname, '../actions'),
    prefix: 'files',
    setTransportsAsDefault: true,
    transports: ['amqp'],
  },
  extensions: {
    enabled: ['postRequest', 'preRequest', 'preResponse'],
    register: [autoSchema, auditLog],
  },
};
