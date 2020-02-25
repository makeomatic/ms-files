const assert = require('assert');
const flatstr = require('flatstr');

const hook = require('../../../src/custom/cappasity-info-post');

const file = {
  uploadId: 'f1c9d940-35bf-44f7-9134-89bee51d0ee3',
  uploadType: 'simple',
  c_ver: '4.0.0',
  packed: false,
  status: '3',
};

describe('cappasity-info-post hook test suite', function suite() {
  beforeEach('add stubs', function stubs() {
    this.config = {
      apiDomain: 'api.cappasity.com',
    };

    this.boundHook = hook.bind(this);
  });

  describe('get embedded info', function modelSuite() {
    it('should be able to set embed code', function test() {
      const embeddedFile = this.boundHook(file);

      assert.ok(embeddedFile.embed);

      const expectedAttrs = flatstr(`
          allowfullscreen
          mozallowfullscreen="true"
          webkitallowfullscreen="true"
          width="{{ width }}"
          height="{{ height }}"
          frameborder="0"
          style="border:0;"
          src="https://api.cappasity.com/api/player/f1c9d940-35bf-44f7-9134-89bee51d0ee3/`
          + 'embedded?autorun={{ autorun }}&closebutton={{ closebutton }}&logo={{ logo }}'
          + '&analytics={{ analytics }}&uipadx={{ uipadx }}&uipady={{ uipady }}'
          + '&enablestoreurl={{ enablestoreurl }}&storeurl={{ storeurl }}&hidehints={{ hidehints }}'
          + '&autorotate={{ autorotate }}&autorotatetime={{ autorotatetime }}'
          + '&autorotatedelay={{ autorotatedelay }}&autorotatedir={{ autorotatedir }}'
          + '&hidefullscreen={{ hidefullscreen }}&hideautorotateopt={{ hideautorotateopt }}'
          + '&hidesettingsbtn={{ hidesettingsbtn }}"')
        .replace(/\s+/g, ' ')
        .trim();

      assert.equal(embeddedFile.embed.code, `<iframe ${expectedAttrs}></iframe>`);
    });
  });
});
