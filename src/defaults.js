const path = require('path');
const resolveMessage = require('./messageResolver.js');
const routerExtension = require('mservice').routerExtension;

const autoSchema = routerExtension('validate/schemaLessAction');
const auditLog = routerExtension('audit/log');

module.exports = {
  // enable plugins
  plugins: ['validator', 'logger', 'router', 'amqp', 'redisCluster'],
  // default logger
  logger: true,
  // if env isnt production - print debug logs
  debug: process.env.NODE_ENV !== 'production',
  // schemas
  validator: ['../schemas'],
  // amqp options
  amqp: {
    transport: {
      // round-robin on this queue name
      queue: 'ms-files',
      // we need QoS for certain operations
      neck: 100,
      // add default onComplete handelr
      onComplete: resolveMessage,
    },
    router: {
      enabled: true,
    },
  },
  router: {
    routes: {
      directory: path.join(__dirname, 'actions'),
      prefix: 'files',
      setTransportsAsDefault: true,
      transports: ['amqp'],
    },
    extensions: {
      enabled: ['postRequest', 'preRequest', 'preResponse'],
      register: [autoSchema, auditLog],
    },
  },
  // dlock configuration
  lockManager: {
    lockPrefix: 'dlock!',
    pubsubChannel: '{ms-files}:dlock',
    lock: {
      timeout: 60000,
      retries: 0,
      delay: 100,
    },
  },
  // specify these hooks to make appropriate actions work
  // easiest option is to copy config from test folder
  hooks: {
    'files:info:pre': [],
    'files:upload:pre': [],
    'files:update:pre': [],
    'files:process:pre': [],
    'files:process:post': [],
    'files:info:post': [],
  },
  // storage options
  redis: {
    options: {
      keyPrefix: '{ms-files}',
      lazyConnect: true,
      redisOptions: {
        dropBufferSupport: true,
      },
    },
    luaScripts: path.resolve(__dirname, '../lua'),
  },
  // default storage for files
  transport: [{
    // transport name
    name: 'gce',
    // provide config options
    options: {},
    // set to true when using as a public name
    cname: false,
  }],
  // default transport selection logic
  selectTransport: function selectTransport() {
    return this.providers[0];
  },
  // configuration for dependant services
  users: {
    audience: '*.localhost',
    exportAudience: 'ms-files',
    getInternalData: 'users.getInternalData',
    getMetadata: 'users.getMetadata',
    updateMetadata: 'users.updateMetadata',
  },
  // TTL of key for action list in seconds
  interstoreKeyTTL: 15,
  // minimum remaining time(ms) to a previously saved key for action list
  interstoreKeyMinTimeleft: 2000,
  // upload expiration time ~ 24 hours
  uploadTTL: 60 * 60 * 24,
};
