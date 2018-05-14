const Promise = require('bluebird');
const AbstractFileTransfer = require('ms-files-transport');
const ld = require('lodash');
const createURI = Promise.promisify(require('gcs-resumable-upload').createURI);
const blackhole = require('bunyan-noop');
const bl = require('bl');
const assert = require('assert');
const os = require('os');

// for some reason it doesn't go through it if we just do the obj
const unwrap = datum => datum[0];

// include gcloud
const GStorage = require('@google-cloud/storage');

/**
 * Main transport class
 */
module.exports = class GCETransport extends AbstractFileTransfer {
  static defaultOpts = {
    gce: {
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

  constructor(opts = {}) {
    super();
    this._config = ld.merge({}, GCETransport.defaultOpts, opts);
    this._logger = this._config.logger || blackhole();
    this.setupGCE();
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
   * Creates authenticated instance of gcloud
   */
  setupGCE() {
    this._gcs = new GStorage(this._config.gce);

    try {
      const PubSub = require('@google-cloud/pubsub');

      this._pubsub = new PubSub(this._config.gce);
      this._pubsub._subscriptions = [];
    } catch (e) {
      this._logger.warn('failed to load @google-cloud/pubsub', e);
    }
  }

  /**
   * Creates notification channel
   */
  setupChannel(resourceId) {
    const bucket = this._bucket;
    const gcs = this._gcs;
    const { id, config } = this._config.bucket.channel;

    if (!id || !config.address) {
      this.log.warn('incomplete configuration for notification channel');
      return null;
    }

    return bucket
      .createChannel(id, config)
      .then(unwrap)
      .then((channel) => {
        this.log.debug('created channel %s', id);
        return channel;
      })
      .catch({ code: 400 }, (err) => {
        if (ld.get(err, 'errors[0].reason') === 'channelIdNotUnique' && resourceId) {
          this.log.debug('found existing channel %s - %s', id, resourceId);
          return gcs.channel(id, resourceId);
        }

        throw err;
      })
      .catch({ code: 401 }, (err) => {
        this.log.error('no rights to create channel', err);
        throw err;
      })
      .then((channel) => {
        this._channel = channel;
        return channel.metadata.resourceId;
      });
  }

  /**
   * stops channel
   */
  stopChannel() {
    const channel = this._channel;
    this.log.debug('destroying channel %j', (channel && channel.metadata) || '<noop>');
    return Promise.resolve(channel && channel.stop());
  }

  /**
   * Handles pubsub for object change notifications
   * @return {Subscription}
   */
  subscribe(handler) {
    assert(this._pubsub, '@google-cloud/pubsub not initialized');

    // extract config
    const { pubsub } = this._config.bucket.channel;

    assert(pubsub, 'to subscribe must specify pubsub topic via `pubsub.topic`');
    assert(pubsub.topic, 'to subscribe must specify pubsub topic via `pubsub.topic`');
    assert(pubsub.name, 'must contain a name for proper round-robin distribution');

    const Pubsub = this._pubsub;
    const { name } = pubsub;
    const config = ld.defaults(pubsub.config || {}, {
      terminate: false,
      gaxOpts: {
        autoCreate: true,
      },
    });

    this.log.info('subscribing to %s on %s', pubsub.topic, os.hostname());

    // first find if we have an existing subscription
    const topic = Pubsub.topic(pubsub.topic);
    return topic.subscription(name, config).get(config.gaxOpts).then((data) => {
      this.log.info('subscribed', data);
      const [subscription] = data;
      subscription.on('message', handler);
      subscription.on('error', err => this.log.error({ error: err }, 'failed to subscribe'));
      this._pubsub._subscriptions.push(subscription);

      // for internal cleanup
      if (config.terminate) subscription._terminate = true;

      return subscription;
    });
  }

  /**
   * Creates bucket if it doesn't exist, otherwise
   * returns an existing one
   * @param  {Object} [query]
   * @return {Promise}
   */
  createBucket() {
    const gcs = this._gcs;
    const needle = this._config.bucket.name;

    const gceBucket = gcs.bucket(needle);
    return gceBucket
      .exists()
      .then((data) => {
        const [exists] = data;

        // retrieves bucket gce metadata
        if (exists) {
          return gceBucket.get();
        }

        this.log.debug('initiating createBucket: %s', needle);
        return gcs.createBucket(needle, this._config.bucket.metadata);
      })
      .then(resp => resp[0]);
  }

  /**
   * Ensures that we have rights to write to the
   * specified bucket
   * @returns {Promise<Void>}
   */
  connect() {
    return Promise
      .bind(this)
      .then(this.createBucket)
      .then((bucket) => {
        this._bucket = bucket;
        return bucket;
      });
  }

  /**
   * Disconnects pubsub handlers if they are alive
   * @returns {Promise<Void>}
   */
  close() {
    const subscriptions = this._pubsub && this._pubsub._subscriptions;
    if (subscriptions && subscriptions.length > 0) {
      return Promise.map(subscriptions, (subscription) => {
        // remove message listener
        subscription.removeAllListeners('message');
        subscription.removeAllListeners('error');
        // terminate if needed
        if (subscription._terminate) return subscription.delete();
        // done
        return null;
      });
    }

    return Promise.resolve();
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
    this.log.debug('initiating signing of URL for %s', opts.resource);
    const { cname } = this;
    const {
      action, md5, type, expires, extensionHeaders, resource, ...props
    } = opts;

    const file = this.bucket.file(resource);
    const settings = {
      ...props,
      action,
      expires,
      cname,
      contentMd5: md5,
      contentType: type,
      extensionHeaders,
    };

    return file.getSignedUrl(settings).then(unwrap);
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
    const {
      filename, metadata, generation, ...props
    } = opts;

    this.log.debug('initiating resumable upload of %s', filename);

    return createURI({
      ...props,
      authClient: this.bucket.storage.authClient,
      bucket: this.bucket.name,
      file: filename,
      generation,
      metadata,
    });
  }

  /**
   * Download file/stream
   * @param {String} filename - what do we want to download
   * @param {Object} opts
   * @param {Number} [opts.start]
   * @param {Number} [opts.end]
   * @param {Function} opts.onError    - returns error if it happens
   * @param {Function} opts.onResponse - returns response headers and status
   * @param {Function} opts.onData     - returns data chunks
   * @param {Function} opts.onEnd      - fired when transfer is completed
   */
  readFileStream(filename, opts = {}) {
    this.log.debug('initiating read of %s', filename);
    const {
      onError,
      onResponse,
      onData,
      onEnd,
      ..._opts
    } = opts;

    const file = this.bucket.file(filename);
    const stream = file.createReadStream(_opts);

    // attach event handles if they are present
    ['onError', 'onResponse', 'onData', 'onEnd'].forEach((opt) => {
      const thunk = opts[opt];
      if (typeof thunk === 'function') {
        stream.on(opt.slice(2).toLowerCase(), thunk);
      }
    });

    return stream;
  }

  /**
   * Upload filestream
   * @param  {String} filename
   * @param  {Object} opts
   * @return {Stream}
   */
  writeStream(filename, opts) {
    this.log.debug('initiating upload of %s', filename);
    const file = this.bucket.file(filename);
    return file.createWriteStream(opts);
  }

  /**
   * Makes file publicly accessible
   * @param  {String} filename
   * @return {Promise}
   */
  makePublic(filename) {
    const file = this.bucket.file(filename);
    return file.makePublic();
  }

  /**
   * Makes file public
   * @param  {String} filename
   * @return {Promise}
   */
  makePrivate(filename, options = {}) {
    const file = this.bucket.file(filename);
    return file.makePrivate(options);
  }

  /**
   * Download file
   * @param {String} filename - what do we want to download
   * @param {Object} opts
   * @return {Promise}
   */
  readFile(filename, opts) {
    return Promise.fromNode((next) => {
      let response = null;
      this.readFileStream(filename, opts)
        .on('response', (httpResponse) => {
          response = httpResponse;
        })
        .pipe(bl((err, contents) => {
          if (err) {
            return next(err);
          }

          return next(null, { response, contents });
        }));
    });
  }

  /**
   * Tells whether file exists or not
   * @param  {String} filename
   * @return {Promise}
   */
  exists(filename) {
    this.log.debug('initiating exists check of %s', filename);
    const file = this.bucket.file(filename);
    return file.exists();
  }

  /**
   * Removes file from bucket
   * @param  {String} filename
   * @return {Promise}
   */
  remove(filename) {
    this.log.debug('removing file %s', filename);
    const file = this.bucket.file(filename);
    // make sure it is wrapped, so that later we can do .catch(predicate, action)
    return Promise.resolve(file).call('delete');
  }
};
