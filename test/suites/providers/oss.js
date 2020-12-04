const { strictEqual } = require('assert');
const OSSTransport = require('../../../src/providers/oss');

describe('util fetch-data suite', () => {
  it('should be able to create instance', () => {
    const provider = new OSSTransport({
      options: {
        accessKeyId: 'Perchik',
        accessKeySecret: 'FaTCaT',
        bucket: 'perchik',
        region: 'cn',
        secure: true,
      },
    });

    strictEqual(
      // eslint-disable-next-line max-len
      /https:\/\/perchik\.cn\.aliyuncs\.com\/4fb4611d312488add2ca6b7fb62ddec2\/a97de2c6-349e-4f0f-ac85-fd6f1de581b7\/ae77baf5-bb24-4032-bbe8-9f59594dfb33\.pack\?OSSAccessKeyId=Perchik&Expires=(\d+)&Signature=([\w\d\-%]+)&response-content-disposition=5100015755485/
        .test(provider.getDownloadUrlSigned(
          '4fb4611d312488add2ca6b7fb62ddec2/a97de2c6-349e-4f0f-ac85-fd6f1de581b7/ae77baf5-bb24-4032-bbe8-9f59594dfb33.pack',
          '5100015755485'
        )),
      true
    );
  });
});
