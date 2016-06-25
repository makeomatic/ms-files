// cache env ref
const env = process.env;
const path = require('path');

try {
  env.DOTENV_FILE_PATH = env.DOTENV_FILE_PATH || path.resolve(__dirname, '../.env');
  require('ms-conf');
} catch (e) {
  // fails on CI
}

// amqp conf
const amqp = {
  connection: {
    host: env.RABBITMQ_PORT_5672_TCP_ADDR,
    port: env.RABBITMQ_PORT_5672_TCP_PORT,
  },
};

// redis conf
const redisHosts = Object.keys(env)
  .filter(key => /^redis[_\-]\d+_port_6379_tcp_addr$/i.test(key))
  .map(key => ({
    host: env[key],
    port: env[key.replace('ADDR', 'PORT')],
  }));

// full configuration
module.exports = {
  amqp,
  redis: {
    hosts: redisHosts,
  },
  transport: [{
    options: {
      gce: {
        projectId: env.GCLOUD_PROJECT_ID,
        credentials: {
          client_email: env.GCLOUD_PROJECT_EMAIL,
          private_key: env.GCLOUD_PROJECT_PK,
        },
      },
      bucket: {
        name: env.GCLOUD_PROJECT_BUCKET,
        metadata: {
          location: env.GCLOUD_BUCKET_LOCATION || 'EUROPE-WEST1',
          dra: true,
        },
      },
      // test for direct public URLs
    },
    cname: true,
  }],
  hooks: {
    // return input, assume there are models
    'files:upload:pre': files => files,
    // process files hook -> noop
    'files:process:pre': [],
    'files:process:post': [],
    // alias -> username
    'files:info:pre': alias => alias,
    // update pre-processor
    'files:update:pre': [],
    // return same username, because we mock it
    'files:download:alias': username => username,
    'files:info:post': require('../../src/custom/cappasity-info-post'),
  },
};
