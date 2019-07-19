const path = require('path');
const { routerExtension, ActionTransport } = require('@microfleet/core');

const autoSchema = routerExtension('validate/schemaLessAction');
const metricObservability = routerExtension('audit/metrics');
const auditLog = require('../utils/audit-log');

exports.router = {
  routes: {
    directory: path.resolve(__dirname, '../actions'),
    prefix: 'files',
    setTransportsAsDefault: false,
    transports: [ActionTransport.amqp, ActionTransport.http],
    enabledGenericActions: [
      'health',
    ],
  },
  extensions: {
    enabled: ['postRequest', 'preRequest', 'preResponse', 'postResponse'],
    register: [autoSchema, auditLog, metricObservability()],
  },
};
