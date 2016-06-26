#!/usr/bin/env node

'use strict';

var dir;
if (process.env.NODE_ENV === 'production') {
  dir = '../lib';
} else {
  dir = '../src';
  require('babel-register');
}

// accepts conf through .env file
// suitable for configuring this in the docker env
const configuration = require('ms-conf').get('/');
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
