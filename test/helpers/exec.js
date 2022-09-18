const Promise = require('bluebird');
const spawn = require('child_process').execFile;
const assert = require('assert');
const transport = require('../configs/generic/core').amqp.transport.connection;

module.exports = (binaryPath, extraArgs = []) => function exec(args = []) {
  return Promise.fromCallback((next) => (
    spawn(binaryPath, [...extraArgs, ...args], {
      timeout: 20000,
      env: {
        NCONF_NAMESPACE: 'MS_FILES',
        MS_FILES__AMQP__TRANSPORT__CONNECTION__HOST: transport.host,
        MS_FILES__AMQP__TRANSPORT__CONNECTION__PORT: transport.port,
        ...process.env,
      },
      cwd: process.cwd(),
    }, (err, stdout, stderr) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.info(stdout.split('\n'));
        return next(err);
      }

      try {
        assert.equal(stderr, '');
        // eslint-disable-next-line no-console
        console.info(stdout.split('\n'));
      } catch (e) {
        return next(e);
      }

      const lines = stdout.split('\n');
      return next(null, lines.slice(0, -1));
    })
  ));
};
