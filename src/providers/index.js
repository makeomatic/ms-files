const Promise = require('bluebird');
const { Microfleet, PluginTypes } = require('@microfleet/core');
const { strict: assert } = require('assert');
const ProviderFactory = require('./factory');
const {
  TRANSPORT_NAME_GCE,
  TRANSPORT_NAME_OSS,
  TRANSPORT_NAME_CLOUDFLARE_STREAM,
} = require('../constant');

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
  service.providersByName = Object.create(null);

  for (const transport of service.config.transport) {
    if (transport.name === TRANSPORT_NAME_GCE) {
      const provider = factory.getProviderGCE(transport);

      service.providers.push(provider);
      service.providersByName[TRANSPORT_NAME_GCE] = provider;
    }

    if (transport.name === TRANSPORT_NAME_OSS) {
      const provider = factory.getProviderOSS(transport);

      service.providers.push(provider);
      service.providersByName[TRANSPORT_NAME_OSS] = provider;
    }

    if (transport.name === TRANSPORT_NAME_CLOUDFLARE_STREAM) {
      const provider = factory.getProviderCloudflareStream(transport);

      service.providers.push(provider);
      service.providersByName[TRANSPORT_NAME_CLOUDFLARE_STREAM] = provider;
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
