import { version } from '../../src';

// The package index reaches @cubejs-backend/cubestore-driver, which loads the Rust
// addon. version() needs none of it, and requiring a built native module would make
// this unit test depend on a cargo build.
jest.mock('@cubejs-backend/cubestore-driver', () => ({
  CubeStoreDriver: class {},
  CubeStoreCacheDriver: class {},
  CubeStoreQueueDriver: class {},
}), { virtual: true });

const VAR = 'CUBEJS_CACHE_DIGEST_ALGORITHM';

const CACHE_KEYS: unknown[] = [
  'simple',
  ['a', 'b'],
  { cube: 'Orders', measures: ['count'] },
  42,
];

describe('pre-aggregation version()', () => {
  const original = process.env[VAR];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[VAR];
    } else {
      process.env[VAR] = original;
    }
  });

  // Pins the default digest. These are the values stock Cube produces; a change here
  // means every pre-aggregation table in every existing deployment gets a new name
  // and is rebuilt once on upgrade.
  test('default digest produces unchanged table versions', () => {
    delete process.env[VAR];

    expect(CACHE_KEYS.map((key) => version(key)))
      .toEqual(['ebtezx0v', 'f5piqitx', 'oov0iyfc', 'bfunmu5h']);
  });

  // version() consumes exactly five bytes of the digest before base-32 encoding them,
  // so a longer digest must not lengthen the table name. Pre-aggregation table names
  // are built from this and warehouses cap identifier length.
  test('version length does not depend on the digest algorithm', () => {
    for (const algorithm of ['md5', 'sha256', 'sha512']) {
      process.env[VAR] = algorithm;

      for (const key of CACHE_KEYS) {
        expect(version(key)).toHaveLength(8);
      }
    }
  });

  test('distinct cache keys produce distinct versions', () => {
    delete process.env[VAR];

    const versions = CACHE_KEYS.map((key) => version(key));

    expect(new Set(versions).size).toEqual(versions.length);
  });

  test('a cache key maps to one version under a given algorithm', () => {
    for (const algorithm of ['md5', 'sha256']) {
      process.env[VAR] = algorithm;

      expect(version({ cube: 'Orders' })).toEqual(version({ cube: 'Orders' }));
    }
  });

  // Switching the algorithm is a deliberate, one-off cache invalidation. Asserting the
  // versions differ keeps that consequence visible rather than surprising an operator
  // mid-upgrade.
  test('changing the algorithm changes the version', () => {
    process.env[VAR] = 'md5';
    const withMd5 = version('simple');

    process.env[VAR] = 'sha256';
    const withSha256 = version('simple');

    expect(withSha256).not.toEqual(withMd5);
  });
});
