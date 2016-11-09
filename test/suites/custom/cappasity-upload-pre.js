const hook = require('../../../src/custom/cappasity-upload-pre');
const reject = require('lodash/reject');
const { inspectPromise } = require('../../helpers/utils');

describe('cappasity-upload-pre hook test suite', function suite() {
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
    };

    it('should pass', function test() {
      return hook(data)
        .reflect()
        .then(inspectPromise());
    });

    it('should fail due to no c-bin files passed', function test() {
      const payload = {
        ...data,
        files: reject(data.files, { type: 'c-bin' }),
      };

      return hook(payload)
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

      return hook(payload)
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

      return hook(payload)
        .reflect()
        .then(inspectPromise(false));
    });

    it('should pass when both flags `export` and `temp` are passed', function test() {
      const payload = {
        ...data,
        export: true,
        temp: true,
      };

      return hook(payload)
        .reflect()
        .then(inspectPromise());
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
      unlisted: true,
      resumable: true, // backward compability
    };

    it('should pass for cappasity preview', function test() {
      return hook(data)
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

      return hook(payload)
        .reflect()
        .then(inspectPromise());
    });

    it('should pass for simple model', function test() {
      const payload = {
        ...data,
        files: [{
          type: 'simple',
        }],
        resumable: false,
        unlisted: undefined,
      };

      return hook(payload)
        .reflect()
        .then(inspectPromise());
    });

    it('should fail when passed simple model with options of resumable upload', function test() {
      const payload = {
        ...data,
        files: [{
          type: 'simple',
        }],
        resumable: false,
        temp: true,
      };

      return hook(payload)
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

      return hook(payload)
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

      return hook(payload)
        .reflect()
        .then(inspectPromise(false));
    });

    it('should fail when file is listed', function test() {
      const payload = {
        ...data,
        unlisted: false,
      };

      return hook(payload)
        .reflect()
        .then(inspectPromise(false));
    });

    it('should fail when several non-model files are passed', function test() {
      const payload = {
        ...data,
        files: [{
          type: 'background',
        }, {
          type: 'c-preview',
        }],
      };

      return hook(payload)
        .reflect()
        .then(inspectPromise(false));
    });
  });
});
