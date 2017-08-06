// cache env ref
const env = process.env;
const sinon = require('sinon');
const Promise = require('bluebird');
const originalPredicate = require('../../src/configs/amqp').amqp.retry.predicate;

try {
  require('ms-conf').reload();
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
  },
  retry: {
    predicate: sinon.spy(originalPredicate),
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

module.exports.enablePubsub = function enablePubsub() {
  module.exports.transport[0].options.bucket.channel = {
    pubsub: {
      topic: 'gcs-object-create',
      name: 'test-runner',
      config: {
        terminate: true,
      },
    },
  };
};

module.exports.disablePubsub = function disablePubsub() {
  module.exports.transport[0].options.bucket.channel = null;
};

module.exports.migrations = {
  enabled: false,
};
