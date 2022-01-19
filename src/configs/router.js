const path = require('path');
const { Extensions: { auditLog } } = require('@microfleet/plugin-router');
const { metricObservability } = require('@microfleet/plugin-prometheus/lib/metrics');

exports.router = {
  routes: {
    directory: path.resolve(__dirname, '../actions'),
    prefix: 'files',
    enabledGenericActions: [
      'health',
    ],
  },
  extensions: {
    register: [auditLog(), metricObservability],
  },
};
