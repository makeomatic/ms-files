{
  // enable plugins
  plugins: ['validator', 'logger', 'amqp', 'redisCluster'],
  // default logger
  logger: true,
  // schemas
  validator: ['../schemas'],
  // amqp options
  amqp: {
    // round-robin on this queue name
    queue: 'ms-files',
    // we need QoS for certain operations
    neck: 100,
    // initRoutes and router
    initRoutes: true,
    initRouter: true,
    // prefixes
    prefix: 'files',
    // postfixes for routes
    postfix: path.join(__dirname, 'actions'),
    // add default onComplete handelr
    onComplete: resolveMessage,
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
    'files:process:post': [],
    'files:info:post': [],
  },
  // storage options
  redis: {
    options: {
      keyPrefix: '{ms-files}',
      dropBufferSupport: false,
      redisOptions: {},
    },
  },
  // default storage for files
  transport: {
    // transport name
    name: 'gce',
    // provide config options
    options: {},
    // set to true when using as a public name
    cname: false,
  },
  users: {
    audience: '*.localhost',
    getInternalData: 'users.getInternalData',
    getMetadata: 'users.getMetadata',
    updateMetadata: 'users.updateMetadata',
  },
  // TTL of key for action list in seconds
  interstoreKeyTTL: 15,
  // minimum remaining time(ms) to a previously saved key for action list
  interstoreKeyMinTimeleft: 2000,
};