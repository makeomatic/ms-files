const assert = require('assert');
const mod = require('../../../src/utils/bust-cache');
const {
  FILES_INDEX,
  FILES_INDEX_PUBLIC,
  FILES_INDEX_TEMP,

  FILES_USER_INDEX_KEY,
  FILES_USER_INDEX_PUBLIC_KEY,

  FILES_OWNER_FIELD,
  FILES_PUBLIC_FIELD,
  FILES_TEMP_FIELD,
  FILES_UNLISTED_FIELD,
} = require('../../../src/constant');

const { getIndiciesList } = mod;

function tester(file, accessChanged, expectedList) {
  return () => {
    assert.deepStrictEqual(getIndiciesList(file, accessChanged), expectedList);
  };
}

describe('bustCache utils suite', function suite() {
  const username = 'example';
  const file = {
    [FILES_OWNER_FIELD]: username,
  };

  describe('getIndiciesList() suite', function getIndiciesListSuite() {
    const FILES_INDEX_USER = FILES_USER_INDEX_KEY(username);
    const FILES_INDEX_USER_PUB = FILES_USER_INDEX_PUBLIC_KEY(username);

    const BASIC_INDICIES = [
      FILES_INDEX,
      FILES_INDEX_USER,
    ];

    it('should produce an empty list of indicies if file is unlisted', tester({
      [FILES_UNLISTED_FIELD]: 1,
    }, false, []));

    it('should produce a list of default indicies', tester(file, false, BASIC_INDICIES));

    it('should produce a list of indicies for public file', tester({
      ...file,
      [FILES_PUBLIC_FIELD]: 1,
    }, false, [
      ...BASIC_INDICIES,
      FILES_INDEX_PUBLIC,
      FILES_INDEX_USER_PUB,
    ]));

    it('should produce a list of indicies for temp file', tester({
      ...file,
      [FILES_TEMP_FIELD]: 1,
    }, false, [
      FILES_INDEX_TEMP,
    ]));

    it('should produce a list of indices for a file after it was changed to private', tester({
      ...file,
    }, true, [
      ...BASIC_INDICIES,
      FILES_INDEX_PUBLIC,
      FILES_INDEX_USER_PUB,
    ]));

    it('should produce a list of indices for a file after it was changed to public', tester({
      ...file,
      [FILES_PUBLIC_FIELD]: 1,
    }, true, [
      ...BASIC_INDICIES,
      FILES_INDEX_PUBLIC,
      FILES_INDEX_USER_PUB,
    ]));
  });
});
