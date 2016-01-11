require('chai').config.includeStack = true;
const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const Promise = require('bluebird');
const Files = require('../src');
const md5 = require('md5');
const request = require('request-promise');

try {
  process.env.DOTENV_FILE_PATH = __dirname + '/.env';
  require('ms-amqp-conf');
} catch (e) {
  // fails on CI
}

global.AMQP = {
  connection: {
    host: process.env.RABBITMQ_PORT_5672_TCP_ADDR,
    port: process.env.RABBITMQ_PORT_5672_TCP_PORT,
  },
};

global.REDIS = {
  hosts: [
    {
      host: process.env.REDIS_1_PORT_6379_TCP_ADDR,
      port: process.env.REDIS_1_PORT_6379_TCP_PORT,
    },
    {
      host: process.env.REDIS_2_PORT_6379_TCP_ADDR,
      port: process.env.REDIS_2_PORT_6379_TCP_PORT,
    },
    {
      host: process.env.REDIS_3_PORT_6379_TCP_ADDR,
      port: process.env.REDIS_3_PORT_6379_TCP_PORT,
    },
  ],
};

const fileData = fs.readFileSync(path.resolve(__dirname, './fixtures/zomg.png'));
global.SAMPLE_FILE = {
  contents: fileData,
  md5: md5(fileData),
  contentLength: fileData.length,
  contentType: 'image/png',
  name: 'zomg.png',
};

global.UPLOAD_MESSAGE = {
  id: 'test@owner.com',
  contentType: global.SAMPLE_FILE.contentType,
  contentLength: global.SAMPLE_FILE.contentLength,
  name: global.SAMPLE_FILE.name,
  md5Hash: global.SAMPLE_FILE.md5,
};

global.uploadToGoogle = function completeUpload(data) {
  return request.put({
    url: data.location,
    body: global.SAMPLE_FILE.contents,
    headers: {
      'content-length': global.SAMPLE_FILE.contentLength,
    },
  });
};

const config = {
  amqp: global.AMQP,
  redis: global.REDIS,
  transport: {
    options: {
      gce: {
        projectId: process.env.GCLOUD_PROJECT_ID,
        credentials: {
          client_email: process.env.GCLOUD_PROJECT_EMAIL,
          private_key: process.env.GCLOUD_PROJECT_PK,
        },
      },
      bucket: {
        name: process.env.GCLOUD_PROJECT_BUCKET,
        metadata: {
          location: 'EUROPE-WEST1',
          dra: true,
        },
      },
    },
  },
};

function inspectPromise(mustBeFulfilled = true) {
  return function inspection(promise) {
    const isFulfilled = promise.isFulfilled();
    const isRejected = promise.isRejected();

    try {
      expect(isFulfilled).to.be.eq(mustBeFulfilled);
    } catch (e) {
      if (isFulfilled) {
        return Promise.reject(new Error(JSON.stringify(promise.value())));
      }

      throw promise.reason();
    }

    expect(isRejected).to.be.eq(!mustBeFulfilled);
    return mustBeFulfilled ? promise.value() : promise.reason();
  };
}

function startService() {
  this.files = new Files(config);
  return this.files.connect().tap(() => {
    this.amqp = this.files.amqp;
  });
}

function clearService() {
  const nodes = this.files._redis.masterNodes;
  return Promise.map(Object.keys(nodes), nodeKey => {
    return nodes[nodeKey].flushdb();
  })
  .finally(() => {
    return Promise.fromNode(next => this.files.provider._bucket.deleteFiles({ force: true }, next));
  })
  .finally(() => {
    return this.files.close();
  })
  .finally(() => {
    this.amqp = null;
    this.files = null;
  });
}

global.startService = startService;
global.inspectPromise = inspectPromise;
global.clearService = clearService;
