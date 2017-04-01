const Promise = require('bluebird');
const Mservice = require('mservice');
const assert = require('assert');
const debug = require('debug')('ms-files-providers');

const PluginType = Mservice.PluginsTypes.database;

/**
 * Initializes provider based on the configuration
 * @param  {Bunyan} bunyan instance
 * @return {Function}
 */
function initProvider(logger) {
  /**
   * Intiializes transport based on it's configuration
   * @type {Provider}
   */
  return (transport) => {
    debug('initializing transport %j', transport);

    // get abstraction module
    // eslint-disable-next-line import/no-dynamic-require
    const Provider = require(`./${transport.name}`);
    const bucket = transport.options.bucket.name;

    // delegate logging facility
    transport.options.logger = logger.child({ bucket });

    // init provider
    debug('passing options %j', transport.options);
    const provider = new Provider(transport.options);

    // init cname based on provider type and settings
    switch (transport.cname) {
      case true:
        provider.cname = `https://${bucket}`;
        break;

      case 'gce':
        provider.cname = `https://storage.googleapis.com/${bucket}`;
        break;

      default:
        throw new Error(`transport.cname '${transport.cname}' unknown`);
    }

    // pass on expiration configuration
    provider.expire = transport.expire;

    return provider;
  };
}

/**
 * Connects array of providers
 * @return {Function}
 */
function connectProviders(providers) {
  /**
   * Connects providers
   * @return {Promise}
   */
  return () => Promise.map(providers, provider => provider.connect());
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
  return () => Promise.map(providers, provider => provider.close());
}

/**
 * Extends microservice with `.provider` function,
 * initializes providers on the `.providers` key and pushes connector to
 * internal connectors storage
 */
function initProviders(service) {
  assert.ok(service instanceof Mservice, 'service must be an instance of Mservice');

  // select provider predicate
  service.provider = (...args) => {
    return service.config.selectTransport.apply(service, args);
  };

  // providers arr
  service.providers = service
    .config
    .transport.map(initProvider(service.log));

  // internal plugin API
  service._connectors[PluginType].push(connectProviders(service.providers));
  service._destructors[PluginType].push(closeProviders(service.providers));
}

// Public API
module.exports = initProviders;
