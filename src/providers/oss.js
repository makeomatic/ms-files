const { strict: assert } = require('assert');
const Promise = require('bluebird');
const AbstractFileTransfer = require('ms-files-transport');
const OSS = require('ali-oss');

const { encodeURI } = require('../utils/encode-uri');

class OSSTransport extends AbstractFileTransfer {
  constructor(config) {
    super();

    assert(config !== undefined);
    assert(config.options !== undefined);
    assert(config.options.accessKeyId !== undefined);
    assert(config.options.accessKeySecret !== undefined);
    assert(config.options.bucket !== undefined);
    assert(config.options.region !== undefined);

    this.client = new OSS(config.options);
    this.config = config;
    this.urlExpire = config.urlExpire || 1000 * 60 * 60 * 3; // 3h
    // @todo http or https
    if (config.cname !== undefined) {
      this.cname = `https://${config.cname}`;
    } else {
      this.cname = `https://${config.options.bucket}.${config.options.region}.aliyuncs.com`;
    }
  }

  // @todo interface
  getBucketName() {
    return this.config.options.bucket;
  }

  // @todo interface
  getDownloadUrl(filename) {
    return `${this.cname}/${encodeURI(filename, false)}`;
  }

  // @todo interface
  getDownloadUrlSigned(filename, downloadName) {
    return this.client.signatureUrl(filename, {
      expire: this.urlExpire,
      method: 'GET',
      response: {
        // @todo more options ?
        'content-disposition': downloadName,
      },
    });
  }

  // @todo interface
  // eslint-disable-next-line class-methods-use-this
  connect() {
    return Promise.resolve();
  }

  // @todo interface
  // eslint-disable-next-line class-methods-use-this
  close() {
    return Promise.resolve();
  }

  // eslint-disable-next-line class-methods-use-this
  canCopy() {
    return false;
  }
}

OSSTransport.defaultOpts = {};

module.exports = OSSTransport;
