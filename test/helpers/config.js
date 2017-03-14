// cache env ref
const env = process.env;
const path = require('path');
const sinon = require('sinon');
const Promise = require('bluebird');
const onComplete = require('../../src/messageResolver');

try {
  env.DOTENV_FILE_PATH = env.DOTENV_FILE_PATH || path.resolve(__dirname, '../.env');
  require('ms-conf');
} catch (e) {
  // fails on CI
  console.warn(e); // eslint-disable-line no-console
}

// amqp conf
const amqp = {
  transport: {
    connection: {
      host: 'rabbitmq',
      port: 5672,
    },
    onComplete: sinon.spy(onComplete),
  },
};

// redis conf
const redisHosts = [7000, 7001, 7002]
  .map(port => ({ host: 'redis', port }));

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
    // its not a public name!
    cname: 'gce',
  }],
  hooks: {
    // return input, assume there are models
    'files:upload:pre': ({ files, uploadType, meta }) => {
      // specifies type packed
      if (uploadType === 'simple' && files.find(it => it.type === 'c-pack')) {
        meta.packed = '1';
        return Promise.resolve();
      }

      return null;
    },
    // process files hook -> noop
    'files:process:pre': [],
    'files:process:post': sinon.spy((fileData) => {
      if (!fileData.export) {
        // skip processing
        return null;
      }

      fileData[fileData.export.format] = 1;
      return Promise.delay(100);
    }),
    // alias -> username
    'files:info:pre': alias => alias,
    // update pre-processor
    'files:update:pre': [],
    // return same username, because we mock it
    'files:download:alias': username => username,
    'files:info:post': require('../../src/custom/cappasity-info-post'),
  },

  maxTries: 1,
};
