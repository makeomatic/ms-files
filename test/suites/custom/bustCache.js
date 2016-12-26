const assert = require('assert');
const difference = require('lodash/difference');
const mod = require('../../../src/utils/bustCache');
const {
  FILES_INDEX,
  FILES_INDEX_PUBLIC,
  FILES_INDEX_TEMP,

  FILES_OWNER_FIELD,
  FILES_PUBLIC_FIELD,
  FILES_TEMP_FIELD,
  FILES_UNLISTED_FIELD,
} = require('../../../src/constant');

const { getIndiciesList } = mod;

function tester(file, expectedList) {
  return () => {
    assert.deepStrictEqual(getIndiciesList(file), expectedList);
  };
}

describe('bustCache utils suite', function suite() {
  const username = 'example';
  const file = {
    [FILES_OWNER_FIELD]: username,
  };

  describe('getIndiciesList() suite', function getIndiciesListSuite() {
    const FILES_INDEX_USER = `${FILES_INDEX}:${username}`;
    const FILES_INDEX_USER_PUB = `${FILES_INDEX_USER}:pub`;

    const BASIC_INDICIES = [
      FILES_INDEX,
      FILES_INDEX_USER,
    ];

    it('should produce an empty list of indicies if file is unlisted', tester({
      [FILES_UNLISTED_FIELD]: 1,
    }, []));

    it('should produce a list of default indicies', tester(file, BASIC_INDICIES));

    it('should produce a list of indicies for public file', tester({
      ...file,
      [FILES_PUBLIC_FIELD]: 1,
    }, [
      ...BASIC_INDICIES,
      FILES_INDEX_PUBLIC,
      FILES_INDEX_USER_PUB,
    ]));

    it('should produce a list of indicies for temp file', tester({
      ...file,
      [FILES_TEMP_FIELD]: 1,
    }, [
      FILES_INDEX_TEMP,
    ]));
  });
});

