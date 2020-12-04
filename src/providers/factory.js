const createDebug = require('debug');

const debug = createDebug('ms-files-providers');

class ProviderFactory {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Initializes provider based on the configuration
   * Intiializes transport based on it's configuration
   * @param  {Bunyan} bunyan instance
   * @return {Function}
   */
  getProviderGCE(transport) {
    debug('initializing transport %j', transport);

    // get abstraction module
    // eslint-disable-next-line import/no-dynamic-require
    const Provider = require('./gce');
    const bucket = transport.options.bucket.name;

    // delegate logging facility
    transport.options.logger = this.logger.child({ bucket });

    // init provider
    debug('passing options %j', transport.options);
    const provider = new Provider(transport.options);

    // init cname based on provider type and settings
    switch (transport.cname) {
      case true:
        provider.cname = `https://${bucket}`;
        provider.rename = true;
        break;

      case 'gce':
        provider.cname = `https://storage.googleapis.com/${bucket}`;
        provider.rename = false;
        break;

      default:
        throw new Error(`transport.cname '${transport.cname}' unknown`);
    }

    // pass on expiration configuration
    provider.expire = transport.expire;

    return provider;
  }

  // eslint-disable-next-line class-methods-use-this
  getProviderOSS(transport) {
    const ProviderOSS = require('./oss');
    const provider = new ProviderOSS(transport);

    return provider;
  }
}

module.exports = ProviderFactory;
