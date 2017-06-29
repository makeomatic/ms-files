const assert = require('assert');
const sinon = require('sinon');
const set = require('lodash/set');
const noop = require('lodash/noop');
const reject = require('lodash/reject');

const config = require('../../../src/config').get('/');
const hook = require('../../../src/custom/cappasity-upload-pre');
const { inspectPromise } = require('../../helpers/utils');
const { FILES_INDEX } = require('../../../src/constant');

const { audience } = config.users;

const usernames = [
  'admin',
  'free',
  'professional',
];

const mockPlan = value => set({}, 'meta.embeddings.value', value);

const mockMetadata = (username, attributes) => ({
  username,
  [audience]: attributes,
});

const plans = {
  free: mockPlan(1),
  professional: mockPlan(10),
};

const metadata = {
  free: mockMetadata('free', { plan: 'free', roles: [] }),
  professional: mockMetadata('professional', { plan: 'professional', roles: [] }),
  admin: mockMetadata('admin', { plan: 'professional', roles: ['admin'] }),
  adminLimit: mockMetadata('adminLimit', { plan: 'free', roles: ['admin'] }),
};

const uploadedFiles = {
  free: 10,
  professional: 1,
  admin: 1,
  adminLimit: 10,
};

describe('cappasity-upload-pre hook test suite', function suite() {
  before('add stubs', function stubs() {
    this.amqp = {
      publishAndWait: noop,
    };

    this.redis = {
      scard: noop,
    };

    this.hook = (name, ...args) => {
      if (name === 'files:info:pre') {
        return require('../../../src/custom/alias-to-username-cappasity').apply(this, args);
      }

      throw new Error('unexpected hook');
    };

    const amqpStub = sinon.stub(this.amqp, 'publishAndWait');
    const redisStub = sinon.stub(this.redis, 'scard');

    const { planGet } = config.payments;
    const { getMetadata } = config.users;

    this.config = config;
    this.boundHook = hook.bind(this);

    const plansList = [
      'free',
      'professional',
    ];

    plansList.forEach((id) => {
      amqpStub
        .withArgs(planGet.route, { id })
        .resolves(plans[id]);
    });

    usernames.forEach((username) => {
      amqpStub
        .withArgs(getMetadata, sinon.match({ username }))
        .resolves(metadata[username]);

      redisStub
        .withArgs(`${FILES_INDEX}:${username}`)
        .resolves(uploadedFiles[username]);
    });
  });

  describe('validate model files', function modelSuite() {
    const data = {
      files: [{
        type: 'c-bin',
      }, {
        type: 'c-texture',
      }, {
        type: 'c-archive',
      }],
      meta: {},
      owner: 'professional',
      resumable: true,
    };

    it('should pass - regular user, limit has not been reached', function test() {
      return this.boundHook(data)
        .reflect()
        .then(inspectPromise());
    });

    it('should fail - regular user, limit has been reached', function test() {
      return this.boundHook({ ...data, owner: 'free' })
        .reflect()
        .then(inspectPromise(false));
    });

    it('should pass - admin user, limit has not been reached', function test() {
      return this.boundHook({ ...data, owner: 'admin' })
        .reflect()
        .then(inspectPromise());
    });

    it('should pass - admin user, limit has been reached', function test() {
      return this.boundHook({ ...data, owner: 'admin' })
        .reflect()
        .then(inspectPromise());
    });

    it('should fail due to no c-bin files passed', function test() {
      const payload = {
        ...data,
        files: reject(data.files, { type: 'c-bin' }),
      };

      return this.boundHook(payload)
        .reflect()
        .then(inspectPromise(false));
    });

    it('should fail due to no temp flag passed along with export flag', function test() {
      const payload = {
        ...data,
        meta: {
          export: true,
        },
      };

      return this.boundHook(payload)
        .reflect()
        .then(inspectPromise(false));
    });

    it('should fail when several c-bin files are passed', function test() {
      const payload = {
        ...data,
        files: [{
          type: 'c-bin',
        }, {
          type: 'c-bin',
        }],
      };

      return this.boundHook(payload)
        .reflect()
        .then(inspectPromise(false));
    });

    it('should pass when both flags `export` and `temp` are passed', function test() {
      const payload = {
        ...data,
        export: true,
        temp: true,
      };

      return this.boundHook(payload)
        .reflect()
        .then(inspectPromise());
    });

    it('should fail when several non-model files are passed', function test() {
      const payload = {
        ...data,
        files: [{
          type: 'background',
        }, {
          type: 'background',
        }],
      };

      return this.boundHook(payload)
        .reflect()
        .then(inspectPromise(false));
    });
  });

  describe('validate non-model files', function nonModelSuite() {
    const data = {
      files: [{
        type: 'c-preview',
      }],
      access: {
        setPublic: true,
      },
      owner: 'free',
      unlisted: true,
      resumable: true, // backward compability
    };

    it('should pass for cappasity preview', function test() {
      return this.boundHook(data)
        .reflect()
        .then(inspectPromise());
    });

    it('should pass for background image', function test() {
      const payload = {
        ...data,
        files: [{
          type: 'background',
        }],
      };

      return this.boundHook(payload)
        .reflect()
        .then(inspectPromise());
    });

    it('should pass for simple model', function test() {
      const payload = {
        ...data,
        files: [{
          type: 'c-simple',
        }],
        resumable: false,
        uploadType: 'simple',
      };

      return this.boundHook(payload)
        .reflect()
        .then(inspectPromise());
    });

    it('should pass for packed model and set packed = 1', function test() {
      const payload = {
        ...data,
        meta: {},
        files: [{
          type: 'c-pack',
        }],
        resumable: false,
        uploadType: 'simple',
      };

      return this.boundHook(payload)
        .reflect()
        .then(inspectPromise())
        .then(() => {
          assert.equal(payload.meta.packed, '1');
          return null;
        });
    });

    it('should fail when passed a simpe model, but uploadType is not defined', function test() {
      const payload = {
        ...data,
        files: [{
          type: 'c-simple',
        }],
        resumable: false,
      };

      return this.boundHook(payload)
        .reflect()
        .then(inspectPromise(false));
    });

    it('should fail when passed a single non-preview, non-background file', function test() {
      const payload = {
        ...data,
        files: [{
          type: 'c-bin',
        }],
      };

      return this.boundHook(payload)
        .reflect()
        .then(inspectPromise(false));
    });

    it('should fail when file is private', function test() {
      const payload = {
        ...data,
        access: {
          setPublic: false,
        },
      };

      return this.boundHook(payload)
        .reflect()
        .then(inspectPromise(false));
    });

    it('should fail when file is listed', function test() {
      const payload = {
        ...data,
        unlisted: false,
      };

      return this.boundHook(payload)
        .reflect()
        .then(inspectPromise(false));
    });

    it('should fail when mixed content are passed', function test() {
      const payload = {
        ...data,
        files: [{
          type: 'background',
        }, {
          type: 'c-preview',
        }],
      };

      return this.boundHook(payload)
        .reflect()
        .then(inspectPromise(false));
    });
  });
});
