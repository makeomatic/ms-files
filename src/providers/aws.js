const Promise = require('bluebird');
const AbstractFileTransfer = require('ms-files-transport');
const { merge } = require('lodash');
const S3 = require('aws-sdk/clients/s3');

const DOWNLOAD_URL_EXPIRES_IN_SEC = 60000;

/**
 * Main transport class
 */
class AWSTransport extends AbstractFileTransfer {
  constructor(opts = {}) {
    super();
    this._config = merge({}, AWSTransport.defaultOpts, opts);
    this._logger = this._config.logger;
    this.setupAWS();
  }

  /**
   * Returns logger or noop
   * @return {Bunyan}
   */
  get log() {
    return this._logger;
  }

  /**
   * Returns base configuration
   */
  get config() {
    return this._config;
  }

  /**
   * Creates authenticated instance of aws s3
   */

  setupAWS() {
    try {
      this._aws = new S3({
        signatureVersion: 'v4',
        region: this._config.region,
        credentials: {
          accessKeyId: this._config.awsAccessKeyId,
          secretAccessKey: this._config.awsSecretAccessKey,
        },
      });
    } catch (err) {
      this._logger.warn({ err }, 'failed to load aws-sdk/clients/s3');
    }
  }

  /**
   * Creates notification channel
   */
  setupChannel() {
    this._logger.warn('the method is not implemented yet');
  }

  /**
   * stops channel
   */
  stopChannel() {
    this._logger.warn('the method is not implemented yet');
  }

  /**
   * Handles pubsub for object change notifications
   * @return {Subscription}
   */
  async subscribe() {
    this._logger.warn('the method is not implemented yet');
  }

  /**
   * Creates bucket if it doesn't exist, otherwise
   * returns an existing one
   * @param  {Object} [query]
   * @return {Promise}
   */
  async createBucket() {
    // const { bucketName } = this._config;

    const aws = this._aws;

    this._bucket = {
      name: this._config.bucket.name,
      deleteFiles: () => { },
    };

    async function handleListBuckets(err, data) {
      if (err) {
        this._logger.warn('s3 bucket can not be created');
      } else {
        const buckets = data.Buckets;

        const bucketParams = {
          Bucket: this._config.bucket.name,
        };

        const isBucketExist = buckets.find((item) => item.name === this._config.bucket.name).length;

        if (!isBucketExist) {
          await aws.createBucket(bucketParams, function handleCreateBucket(_err) {
            if (_err) {
              this._logger.warn('s3 bucket can not be created');
            }
          });
        }
      }
    }

    aws.listBuckets(handleListBuckets);
  }

  /**
   * Ensures that we have rights to write to the
   * specified bucket
   * @returns {Promise<Void>}
   */
  connect() {
    return this.createBucket();
  }

  /**
   * Disconnects pubsub handlers if they are alive
   * @returns {Promise<Void>}
   */
  close() {
    this._logger.warn('the method is not implemented yet');
  }

  // @todo interface
  getDownloadUrlSigned(filename, downloadName) {
    this._logger.warn(`${downloadName} is not implemented yet`);

    const params = {
      Bucket: this._config.bucketName,
      Expires: DOWNLOAD_URL_EXPIRES_IN_SEC,
      Key: filename,
    };

    return new Promise((resolve, reject) => {
      this._aws.getSignedUrl('putObject', params, (err, url) => {
        if (err) {
          return reject(err);
        }
        return resolve(url);
      });
    });
  }

  // @todo interface
  getBucketName() {
    return this._config.bucket.name;
  }

  /**
   * Initializes resumable upload
   * @param  {Object} opts
   * @param  {String} opts.filename
   * @param  {Object} opts.metadata
   * @param  {String} opts.metadata.contentLength
   * @param  {String} opts.metadata.contentType - must be included
   * @param  {String} opts.metadata.md5Hash - must be included
   * @param  {String} [opts.metadata.contentEncoding] - optional, can be set to gzip
   * @return {Promise}
   */
  initResumableUpload(opts) {
    const params = {
      Bucket: this._config.bucket.name,
      Expires: DOWNLOAD_URL_EXPIRES_IN_SEC,
      Key: opts.filename,
    };

    params.ContentType = opts.contentType;

    return new Promise((resolve, reject) => {
      this._aws.getSignedUrl('putObject', params, (err, url) => {
        if (err) {
          return reject(err);
        }
        return resolve(url);
      });
    });
  }

  /**
   * Creates signed URL
   *
   * StringToSign = HTTP_Verb + "\n" +
   *    Content_MD5 + "\n" +
   *    Content_Type + "\n" +
   *    Expiration + "\n" +
   *    Canonicalized_Extension_Headers +
   *    Canonicalized_Resource
   *
   * @param {String="read","write","delete"} action
   * @param {String} [type]   Content-Type, do not supply for downloads
   * @param {String} resource `/path/to/objectname/without/bucket`
   *                          You construct the Canonicalized_Resource portion of the message by concatenating the resource path
   *                          (bucket and object and subresource) that the request is acting on. To do this, you can use the following process:
   *                          * Begin with an empty string.
   *                          * If the bucket name appears in the Host header, add a slash and the bucket name to the string (for example,
   *                          /example-travel-maps). If the bucket name appears in the path portion of the HTTP request, do nothing.
   *                          * Add the path portion of the HTTP request to the string, excluding any query string parameters. For example,
   *                          if the path is /europe/france/paris.jpg?cors and you already added the bucket example-travel-maps to the string,
   *                          then you need to add /europe/france/paris.jpg to the string.
   *                          * If the request is scoped to a subresource, such as ?cors, add this subresource to the string, including the
   *                          question mark.
   *                          * Be sure to copy the HTTP request path literally: that is, you should include all URL encoding (percent signs)
   *                          in the string that you create. Also, be sure that you include only query string parameters that designate
   *                          subresources (such as cors). You should not include query string parameters such as ?prefix,
   *                          ?max-keys, ?marker, and ?delimiter.
   * @param {String} [md5] - md5 digest of content - Optional. The MD5 digest value in base64. If you provide this in the string,
   *                 the client (usually a browser) must provide this HTTP header with this same value in its request.
   * @param {Number} expires   This is the timestamp (represented as the number of miliseconds since the Unix Epoch
   *                           of 00:00:00 UTC on January 1, 1970) when the signature expires
   * @param {String} [extensionHeaders] :
   *                           You construct the Canonical Extension Headers portion of the message by concatenating all extension
   *                           (custom) headers that begin with x-goog-. However, you cannot perform a simple concatenation.
   *                           You must concatenate the headers using the following process:
   *                           * Make all custom header names lowercase.
   *                           * Sort all custom headers by header name using a lexicographical sort by code point value.
   *                           * Eliminate duplicate header names by creating one header name with a comma-separated list of values.
   *                           Be sure there is no whitespace between the values and be sure that the order of the comma-separated
   *                           list matches the order that the headers appear in your request. For more information, see RFC 2616 section 4.2.
   *                           * Replace any folding whitespace or newlines (CRLF or LF) with a single space. For more
   *                           information about folding whitespace, see RFC 2822 section 2.2.3.
   *                           * Remove any whitespace around the colon that appears after the header name.
   *                           * Append a newline (U+000A) to each custom header.
   *                           * Concatenate all custom headers.
   *                           Important: You must use both the header name and the header value when you construct the Canonical Extension Headers
   *                           portion of the query string. Be sure to remove any whitespace around the colon that separates the header name and
   *                           value. For example, using the custom header x-goog-acl: private without removing the space after the colon will
   *                           return a 403 Forbidden because the request signature you calculate will not match the signature Google calculates.
   * @returns {Promise}
   */
  createSignedURL(opts) {
    const params = {
      Bucket: this._config.bucket.name,
      Expires: DOWNLOAD_URL_EXPIRES_IN_SEC,
      Key: opts.filename,
    };

    params.ContentType = opts.contentType;

    return new Promise((resolve, reject) => {
      this._aws.getSignedUrl('putObject', params, (err, url) => {
        if (err) {
          return reject(err);
        }
        return resolve(url);
      });
    });
  }

  /**
     * Upload filestream
     * @param  {String} filename
     * @param  {Object} opts
     * @return {Stream}
     */
  writeStream(filename, opts) {
    this._logger.warn('the method is not implemented yet', { filename, opts });
  }

  /**
     * Makes file publicly accessible
     * @param  {String} filename
     * @return {Promise}
     */
  makePublic(filename) {
    this._logger.warn('the method is not implemented yet', { filename });
  }

  /**
     * Makes file public
     * @param  {String} filename
     * @return {Promise}
     */
  makePrivate(filename, options = {}) {
    this._logger.warn('the method is not implemented yet', { filename, options });
  }

  /**
     * Download file=
     * @param {String} filename - what do we want to download
     * @param {Object} opts
     * @return {Promise}
     */
  readFile(filename, opts) {
    this._logger.warn('the method is not implemented yet', { filename, opts });
  }

  /**
     * Tells whether file exists or not
     * @param  {String} filename
     * @return {Promise}
     */
  async exists(filename) {
    this.log.debug('initiating exists check of %s', filename);

    return new Promise((resolve) => {
      this._aws.headObject({ Key: filename, Bucket: this._config.bucket.name }, (err) => {
        if (err) {
          return resolve(false);
        }
        return resolve(true);
      });
    });
  }

  /**
     * Removes file from bucket
     * @param  {String} filename
     * @return {Promise}
     */
  remove(filename) {
    this._logger.warn('the method is not implemented yet', { filename });
  }
}

AWSTransport.defaultOpts = {
  name: 'aws',
  aws: {
    // specify authentication options
    // here
  },
  bucket: {
    // specify bucket
    name: 'must-be-a-valid-bucket-name',
    host: 'storage.cloud.google.com',
    channel: {
      // must be persistent in your app to identify the channel
      id: null,
      pubsub: null,
      config: {
        // change to your webhook address
        address: 'https://localhost:443',
        // token: this is your `SECRET`, so make sure you set it to something unique for your application and
        // verify notification
        token: undefined,
      },
    },
    metadata: {},
  },
};

module.exports = AWSTransport;
