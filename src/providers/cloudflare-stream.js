const { ok } = require('node:assert');
const crypto = require('node:crypto');
const AbstractFileTransfer = require('ms-files-transport');
const Cloudflare = require('cloudflare');
const { HttpStatusError } = require('common-errors');

const toBase64 = (value) => Buffer.from(value).toString('base64');
const nowPlusSeconds = (seconds) => (new Date(Date.now() + 1000 * seconds)).toISOString();
const nowPlus30Days = () => nowPlusSeconds(2592000);
const NotImplementedHttpError = new HttpStatusError(501, 'Method \'copy\' is not implemented');

const arrayBufferToBase64Url = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

const objectToBase64url = (payload) => arrayBufferToBase64Url(
  new TextEncoder().encode(JSON.stringify(payload))
);

class CloudflareStreamTransport extends AbstractFileTransfer {
  constructor(config) {
    super();

    ok(config?.keys);
    ok(config?.options?.accountId);
    ok(config?.options?.apiToken);
    ok(config?.options?.customerSubdomain);

    this.cloudflare = new Cloudflare({ apiToken: config.options.apiToken });
    this.config = config;
    this.expiry = config.expiry || 600; // 10m
    this.keys = config.keys;
    this.maxDurationSeconds = config.maxDurationSeconds || 1800; // 30m
    this.urlExpire = config.urlExpire || 3600; // 1h

    // backward compatibility for src/actions/upload.js:78
    this._bucket = { name: this.getBucketName() };
  }

  // @todo interface
  getBucketName() {
    return this.config.options.customerSubdomain;
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

  async initResumableUpload(opts) {
    const { cloudflare, config, expiry } = this;
    const { accountId } = config.options;
    const { metadata } = opts;
    const { contentLength, username, name } = metadata;
    const uploadMetadata = [
      'requireSignedURLs',
      `maxDurationSeconds ${toBase64('1800')}`,
      `expiry ${toBase64(nowPlusSeconds(expiry))}`,
    ];

    if (name) {
      uploadMetadata.push(`name ${toBase64(name)}`);
    }

    if (process.env.NODE_ENV === 'test') {
      uploadMetadata.push(`scheduledDeletion ${toBase64(nowPlus30Days())}`);
    }

    const params = {
      account_id: accountId,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': contentLength,
      'Upload-Creator': username,
      'Upload-Metadata': uploadMetadata.join(','),
    };
    const options = {
      query: {
        direct_user: 'true',
      },
    };
    // wrap error?
    const { response } = await cloudflare.stream.create(params, options).withResponse();

    return {
      location: response.headers.get('location'),
      filename: response.headers.get('stream-media-id'),
    };
  }

  async exists(filename) {
    const { cloudflare, config } = this;
    const { accountId } = config.options;

    try {
      await cloudflare.stream.get(filename, { account_id: accountId });
    } catch (error) {
      if (error.status === 404) {
        return false;
      }

      throw error;
    }

    return true;
  }

  remove(filename) {
    const { cloudflare, config } = this;
    const { accountId } = config.options;

    return cloudflare.stream.delete(filename, { account_id: accountId });
  }

  randomKey() {
    const { keys } = this;

    return keys[Math.floor(Math.random() * keys.length)];
  }

  async getDownloadUrlSigned(filename) {
    const { config, urlExpire } = this;
    const { customerSubdomain } = config.options;
    const { id: keyId, jwk: jwkKey } = this.randomKey();

    const encoder = new TextEncoder();
    const expiresIn = Math.floor(Date.now() / 1000) + urlExpire;
    const headers = {
      alg: 'RS256',
      kid: keyId,
    };
    const data = {
      sub: filename,
      kid: keyId,
      exp: expiresIn,
    };

    const token = `${objectToBase64url(headers)}.${objectToBase64url(data)}`;
    const jwk = JSON.parse(atob(jwkKey));
    const algorithm = {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    };
    const key = await crypto.subtle.importKey('jwk', jwk, algorithm, false, ['sign']);
    const signature = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, encoder.encode(token));
    const signedToken = `${token}.${arrayBufferToBase64Url(signature)}`;

    return `https://${customerSubdomain}/${signedToken}/manifest/video.m3u8`;
  }

  // eslint-disable-next-line class-methods-use-this
  async copy() {
    throw NotImplementedHttpError;
  }
}

CloudflareStreamTransport.defaultOpts = {};

module.exports = CloudflareStreamTransport;
