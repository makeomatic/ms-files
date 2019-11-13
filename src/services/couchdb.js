
class CouchDBManager {
  constructor(couchdb) {
    this.couchdb = couchdb;
  }

  async prepareUpload(/* uploadId, fileData, partsData, postAction */) {
    return null;
  }
}

module.exports = CouchDBManager;
