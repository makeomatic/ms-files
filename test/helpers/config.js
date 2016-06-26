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
    host: 'rabbitmq',
    port: 5672,
  },
};

// redis conf
const redisHosts = ['1','2','3']
  .map(idx => ({
    host: `redis-${idx}`,
    port: 6379
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
