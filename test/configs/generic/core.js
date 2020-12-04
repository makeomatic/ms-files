/* eslint-disable import/no-dynamic-require */

// workspace
const { env } = process;
const cwd = process.cwd();
const originalPredicate = require(`${cwd}/src/configs/amqp`).amqp.retry.predicate;
const Promise = require(`${cwd}/node_modules/bluebird`);
const sinon = require(`${cwd}/node_modules/sinon`);

exports.amqp = {
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

exports.transport = [{
  name: 'gce',
  options: {
    gce: {
      projectId: env.GCLOUD_PROJECT_ID,
      credentials: {
        client_email: env.GCLOUD_PROJECT_EMAIL,
        private_key: env.GCLOUD_PROJECT_PK,
      },
    },
    bucket: {
      name: env.TEST_BUCKET,
      metadata: {
        location: env.GCLOUD_BUCKET_LOCATION || 'EUROPE-WEST1',
        dra: true,
      },
    },
    // test for direct public URLs
  },
  // its not a public name!
  cname: 'gce',
}, {
  name: 'oss',
  options: {
    // @todo from env
    accessKeyId: 'LTAI4G3Z3EK7G5K7Uy7gohVs',
    // @todo from env
    accessKeySecret: 'AK9u0t9yXJUUQ8MJq7jmND86FdQVZO',
    bucket: 'perchik',
    region: 'cn',
    secure: true,
  },
  urlExpire: 1000 * 60 * 60 * 3, // 3h
}];

exports.hooks = {
  // return input, assume there are models
  'files:upload:pre': ({ files, uploadType, meta }) => {
    // specifies type packed
    if (uploadType === 'simple' && files.find((it) => it.type === 'c-pack')) {
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
  'files:info:pre': (alias) => alias,
  // update pre-processor
  'files:update:pre': [],
  // return same username, because we mock it
  'files:download:alias': (username) => username,
  'files:info:post': require(`${cwd}/src/custom/cappasity-info-post`),
};

exports.maxTries = 1;

exports.migrations = {
  enabled: false,
};
