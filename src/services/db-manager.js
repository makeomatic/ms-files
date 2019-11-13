const Promise = require('bluebird');
const assert = require('assert');

class DatabaseManager {
  constructor(service) {
    this.log = service.log;
    this.isCouchEnabled = service.isCouchEnabled;

    this.providers = [];
    this.providerTypeToProvider = Object.create(null);
  }

  addStorage(provider, type) {
    assert(!this.providerTypeToProvider[type], `${type} already added`);
    this.providerTypeToProvider[type] = provider;
    this.providers.push(provider);
  }

  async runOnProviders(operation, args) {
    return Promise.all(this.providers.map((x) => x[operation](...args)));
  }

  async prepareUpload(uploadId, fileData, partsData, postAction) {
    return this.runOnProviders('prepareUpload', [uploadId, fileData, partsData, postAction]);
  }
}

module.exports = DatabaseManager;
