const is = require('is');
const Promise = require('bluebird');

module.exports = [
  {
    point: 'preRequest',
    handler: (route, request) => {
      request.auditLog = { start: process.hrtime() };
      return Promise.resolve([route, request]);
    },
  },
  {
    point: 'preResponse',
    handler: function preResponse(error, result, request) {
      const service = this;
      const execTime = request.auditLog.execTime = process.hrtime(request.auditLog.start);

      const meta = {
        route: request.route,
        params: request.params,
        method: request.method,
        transport: request.transport,
        headers: request.headers,
        query: request.query,
        latency: (execTime[0] * 1000) + (+(execTime[1] / 1000000).toFixed(3)),
      };

      if (error) {
        const err = is.fn(error.toJSON) ? error.toJSON() : error.toString();
        const { statusCode } = error;

        // determine error level
        let level = 'error';
        if (statusCode && statusCode < 400 && statusCode !== 404) {
          level = 'warn';
        } else if (error.name === 'ValidationError') {
          level = 'warn';
        }

        request.log[level](meta, 'Error performing operation', err);
      } else {
        request.log.info(meta, 'completed operation', service._config.debug ? result : '');
      }

      return Promise.resolve([error, result]);
    },
  },
];
