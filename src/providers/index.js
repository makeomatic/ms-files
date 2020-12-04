const Promise = require('bluebird');
const { Microfleet, PluginTypes } = require('@microfleet/core');
const { strict: assert } = require('assert');
const ProviderFactory = require('./factory');

/**
 * Connects array of providers
 * @return {Function}
 */
function connectProviders(providers) {
  /**
   * Connects providers
   * @return {Promise}
   */
  return () => Promise.map(providers, (provider) => provider.connect());
}

/**
 * Disconnects array of providers
 * @return {Function}
 */
function closeProviders(providers) {
  /**
   * Disconnect providers
   * @return {Promise}
   */
  return () => Promise.map(providers, (provider) => provider.close());
}

/**
 * Extends microservice with `.provider` function,
 * initializes providers on the `.providers` key and pushes connector to
 * internal connectors storage
 */
function initProviders(service) {
  assert(service instanceof Microfleet, 'service must be an instance of Mservice');

  const factory = new ProviderFactory(service.log);
  // select provider predicate
  service.provider = (...args) => {
    return service.config.selectTransport.apply(service, args);
  };
  service.providers = [];

  for (const transport of service.config.transport) {
    if (transport.name === 'gce') {
      service.providers.push(
        factory.getProviderGCE(transport)
      );
    }

    if (transport.name === 'oss') {
      service.providers.push(
        factory.getProviderOSS(transport)
      );
    }
  }

  // create providerByBucket map for fast access
  const providersByBucket = service.providers.reduce((map, provider) => {
    map[provider.getBucketName()] = provider;
    return map;
  }, {});

  // store references
  service.providersByBucket = Object.setPrototypeOf(providersByBucket, null);

  // internal plugin API
  service.addConnector(PluginTypes.database, connectProviders(service.providers));
  service.addDestructor(PluginTypes.database, closeProviders(service.providers));
}

// Public API
module.exports = initProviders;
