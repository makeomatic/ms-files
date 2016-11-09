#!/usr/bin/env node

let dir;
try {
  require('babel-register');
  dir = '../src';
} catch (e) {
  dir = '../lib';
}

// accepts conf through .env file
// suitable for configuring this in the docker env
const configuration = require('ms-conf').get('/');
// eslint-disable-next-line import/no-dynamic-require
const Service = require(dir);
const service = new Service(configuration);

service.connect()
  .then(function serviceUp() {
    service.log.info('Started service');
    return service.postProcess();
  })
  .catch(function serviceCrashed(err) {
    service.log.fatal('Failed to start service', err);
    setImmediate(function escapeTryCatch() {
      throw err;
    });
  });
