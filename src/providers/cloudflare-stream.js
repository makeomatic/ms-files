const { ok } = require('node:assert');
const crypto = require('node:crypto');
const AbstractFileTransfer = require('ms-files-transport');
const Cloudflare = require('cloudflare');
const { HttpStatusError } = require('common-errors');
const stringify = require('safe-stable-stringify');

const {
  FILES_CONTENT_LENGTH_FIELD,
  FILES_NAME_FIELD,
} = require('../constant');

const FileTooLargeHttpError = new HttpStatusError(413, 'The file cannot be larger than 200 MB. For files larger than 200 MB, use resumable upload.');

const toBase64 = (value) => Buffer.from(value).toString('base64');
const nowPlusSeconds = (seconds) => (new Date(Date.now() + 1000 * seconds)).toISOString();
const nowPlus30Days = () => nowPlusSeconds(2592001);
const arrayBufferToBase64Url = (buffer) => Buffer.from(buffer).toString('base64url');
const objectToBase64url = (payload) => arrayBufferToBase64Url(stringify(payload));

// @todo use stream.edit() method when it comes
// https://github.com/cloudflare/cloudflare-typescript/discussions/135#discussioncomment-9045617
const streamEdit = async (cloudflare, params, options) => {
  const { account_id: accountId, identifier, ...body } = params;
  return (
    cloudflare.post(`/accounts/${accountId}/stream/${identifier}`, {
      body,
      ...options,
      headers: { ...options?.headers },
    })
  )._thenUnwrap((obj) => obj.result);
};

class CloudflareStreamTransport extends AbstractFileTransfer {
  static filenameWithPrefix(filename) {
    return `cfs:${filename}`;
  }

  static removeFilenamePrefix(filename) {
    return filename.split(':')[1];
  }

  constructor(config) {
    super();

    ok(config?.keys?.[0]?.id);
    ok(config?.keys?.[0]?.jwk);
    ok(config?.notificationUrl);
    ok(config?.options?.accountId);
    ok(config?.options?.apiToken);
    ok(config?.options?.customerSubdomain);

    this.alwaysRequireSignedURLs = config.alwaysRequireSignedURLs ?? true;
    this.cloudflare = new Cloudflare({
      apiToken: config.options.apiToken,
      maxRetries: config.options.maxRetries, // default is 2
      timeout: config.options.timeout, // default is 1 minute
    });
    this.config = config;
    this.keys = config.keys;
    this.maxDurationSeconds = config.maxDurationSeconds || 1800; // 30m
    this.rename = false;
    this.urlExpire = config.urlExpire || 3600; // 1h
    this.webhookSecret = null;

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

  // eslint-disable-next-line class-methods-use-this
  canCopy() {
    return false;
  }

  // NOTE: Use it for files smaller than 200MB
  async initUpload(opts, uploadParams) {
    const { alwaysRequireSignedURLs, cloudflare, config, maxDurationSeconds } = this;
    const { accountId } = config.options;
    const { metadata: { [FILES_CONTENT_LENGTH_FIELD]: contentLength } } = opts;
    const { access, expires, origin, username, meta: { [FILES_NAME_FIELD]: name } } = uploadParams;
    const setPublic = (access && access.setPublic) || false;

    if (contentLength > 209715200 /* 200 MB */) {
      throw FileTooLargeHttpError;
    }

    const params = {
      maxDurationSeconds,
      account_id: accountId,
      creator: username,
      expiry: nowPlusSeconds(expires),
      requireSignedURLs: alwaysRequireSignedURLs || !setPublic,
      meta: {},
    };

    if (name) {
      params.meta.name = name;
    }

    if (origin) {
      params.allowedOrigins = [origin.replace(/^(https?):\/\//, '')];
    }

    if (process.env.NODE_ENV === 'test') {
      params.scheduledDeletion = nowPlus30Days();
    }

    const { uid, uploadURL } = await cloudflare.stream.directUpload.create(params);

    return {
      location: uploadURL,
      filename: CloudflareStreamTransport.filenameWithPrefix(uid),
    };
  }

  // NOTE: Use it for files bigger than 200MB
  //
  // Important: Cloudflare Stream requires a minimum chunk size of 5,242,880 bytes
  // when using TUS, unless the entire file is less than this amount.
  // We recommend increasing the chunk size to 52,428,800 bytes
  // for better performance when the client connection is expected to be reliable.
  // Maximum chunk size can be 209,715,200 bytes.
  //
  // Important: Cloudflare Stream requires a chunk size divisible by 256KiB (256x1024 bytes).
  // Please round your desired chunk size to the nearest multiple of 256KiB.
  // The final chunk of an upload or uploads that fit within a single chunk are exempt from this requirement.
  async initResumableUpload(opts, uploadParams) {
    const { alwaysRequireSignedURLs, cloudflare, config, maxDurationSeconds } = this;
    const { accountId } = config.options;
    const { metadata: { [FILES_CONTENT_LENGTH_FIELD]: contentLength } } = opts;
    const { access, expires, origin, username, meta: { [FILES_NAME_FIELD]: name } } = uploadParams;
    const setPublic = (access && access.setPublic) || false;

    const uploadMetadata = [
      `maxDurationSeconds ${toBase64(String(maxDurationSeconds))}`,
      `expiry ${toBase64(nowPlusSeconds(expires))}`,
    ];

    if (alwaysRequireSignedURLs || !setPublic) {
      uploadMetadata.push('requireSignedURLs');
    }

    if (origin) {
      uploadMetadata.push(`allowedOrigins ${toBase64(origin)}`);
    }

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
    const { response } = await cloudflare.stream.create(params, options).withResponse();

    return {
      location: response.headers.get('location'),
      filename: CloudflareStreamTransport.filenameWithPrefix(
        response.headers.get('stream-media-id')
      ),
    };
  }

  async exists(filename) {
    const { cloudflare, config } = this;
    const { accountId } = config.options;

    try {
      await cloudflare.stream.get(
        CloudflareStreamTransport.removeFilenamePrefix(filename),
        { account_id: accountId }
      );
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

    return cloudflare.stream.delete(
      CloudflareStreamTransport.removeFilenamePrefix(filename),
      { account_id: accountId }
    );
  }

  randomKey() {
    const { keys } = this;

    return keys[Math.floor(Math.random() * keys.length)];
  }

  async getSignedToken(filename) {
    const { urlExpire } = this;
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
    const jwk = JSON.parse(Buffer.from(jwkKey, 'base64'));
    const algorithm = {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    };
    const key = await crypto.subtle.importKey('jwk', jwk, algorithm, false, ['sign']);
    const signature = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, encoder.encode(token));
    const signedToken = `${token}.${arrayBufferToBase64Url(signature)}`;

    return signedToken;
  }

  async getDownloadUrlSigned(filename) {
    const { config } = this;
    const { customerSubdomain } = config.options;
    const signedToken = await this.getSignedToken(
      CloudflareStreamTransport.removeFilenamePrefix(filename)
    );

    return `https://${customerSubdomain}/${signedToken}/manifest/video.m3u8`;
  }

  async getDownloadUrl(filename) {
    const { alwaysRequireSignedURLs } = this;

    if (alwaysRequireSignedURLs) {
      return this.getDownloadUrlSigned(filename);
    }

    const { config } = this;
    const { customerSubdomain } = config.options;
    const uid = CloudflareStreamTransport.removeFilenamePrefix(filename);

    return `https://${customerSubdomain}/${uid}/manifest/video.m3u8`;
  }

  async getThumbnailUrlSigned(filename) {
    const { config } = this;
    const { customerSubdomain } = config.options;
    const signedToken = await this.getSignedToken(
      CloudflareStreamTransport.removeFilenamePrefix(filename)
    );

    return `https://${customerSubdomain}/${signedToken}/thumbnails/thumbnail.jpg`;
  }

  async getThumbnailUrl(filename) {
    const { alwaysRequireSignedURLs } = this;

    if (alwaysRequireSignedURLs) {
      return this.getThumbnailUrlSigned(filename);
    }

    const { config } = this;
    const { customerSubdomain } = config.options;
    const uid = CloudflareStreamTransport.removeFilenamePrefix(filename);

    return `https://${customerSubdomain}/${uid}/thumbnails/thumbnail.jpg`;
  }

  async initWebhook() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const { cloudflare, config } = this;
    const { notificationUrl, options } = config;
    const { accountId } = options;

    // NOTE: Only one webhook subscription is allowed per-account.
    const { secret } = await cloudflare.stream.webhooks.update({
      notificationUrl,
      account_id: accountId,
    });

    this.webhookSecret = secret;
  }

  validateWebhook(signature, body) {
    const key = this.webhookSecret;
    const [time, sig1] = signature.split(',');
    const [, timeValue] = time.split('=');

    // @todo At this point, you should discard requests with timestamps that are too old for your application.

    const [, sig1Value] = sig1.split('=');
    const signatureSourceString = `${timeValue}.${body}`;
    const hash = crypto.createHmac('sha256', key).update(signatureSourceString);

    return sig1Value === hash.digest('hex');
  }

  async makePublic(filename) {
    const { alwaysRequireSignedURLs, cloudflare, config } = this;
    const { accountId } = config.options;

    return streamEdit(cloudflare, {
      account_id: accountId,
      identifier: CloudflareStreamTransport.removeFilenamePrefix(filename),
      requireSignedURLs: alwaysRequireSignedURLs,
    });
  }

  async makePrivate(filename) {
    const { cloudflare, config } = this;
    const { accountId } = config.options;

    return streamEdit(cloudflare, {
      account_id: accountId,
      identifier: CloudflareStreamTransport.removeFilenamePrefix(filename),
      requireSignedURLs: false,
    });
  }
}

CloudflareStreamTransport.defaultOpts = {};

module.exports = CloudflareStreamTransport;
