const { initTimingExtension, Lifecycle, Extensions } = require('@microfleet/plugin-router');

const { hrTimeDurationInMs } = Extensions;

module.exports = [
  initTimingExtension,
  {
    point: Lifecycle.hooks.preResponse,
    async handler(request) {
      const service = this;
      const { requestStarted, error, response } = request;
      const requestEnded = request.requestEnded = process.hrtime();

      const meta = {
        headers: request.headers,
        latency: hrTimeDurationInMs(requestStarted, requestEnded),
        method: request.method,
        params: request.params,
        query: request.query,
        route: request.route,
        transport: request.transport,
        response: undefined,
      };

      if (error) {
        const err = typeof error.toJSON === 'function' ? error.toJSON() : error.toString();
        const { statusCode } = error;

        // determine error level
        let level = 'error';
        if (statusCode && (statusCode < 400 || statusCode === 404)) {
          level = 'warn';
        } else if (error.name === 'ValidationError') {
          level = 'warn';
        }

        meta.err = error;
        request.log[level](meta, 'Error performing operation: %s', err);
      } else {
        if (service.config.debug) {
          meta.response = response;
        }

        request.log.info(meta, 'completed operation');
      }
    },
  },
];
