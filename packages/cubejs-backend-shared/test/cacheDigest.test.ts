import crypto from 'crypto';

import { createCacheHash } from '../src/cacheDigest';

const VAR = 'CUBEJS_CACHE_DIGEST_ALGORITHM';

describe('createCacheHash', () => {
  const original = process.env[VAR];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[VAR];
    } else {
      process.env[VAR] = original;
    }
  });

  // The default must stay byte-identical to the md5 calls it replaced: a different
  // digest changes every cache key and every pre-aggregation table name, which would
  // invalidate cached results and rebuild every rollup on upgrade.
  test('defaults to md5, byte-identical to the calls it replaced', () => {
    delete process.env[VAR];

    for (const input of ['', 'abc', JSON.stringify({ a: 1, b: [2, 3] }), 'x'.repeat(10_000)]) {
      expect(createCacheHash().update(input).digest('hex'))
        .toEqual(crypto.createHash('md5').update(input).digest('hex'));
    }
  });

  test('honours the configured algorithm', () => {
    process.env[VAR] = 'sha256';

    expect(createCacheHash().update('abc').digest('hex')).toEqual(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(createCacheHash().update('abc').digest('hex'))
      .toEqual(crypto.createHash('sha256').update('abc').digest('hex'));
  });

  test('rejects an unknown algorithm', () => {
    process.env[VAR] = 'not-a-digest';

    expect(() => createCacheHash()).toThrow();
  });

  // crypto.Hash is stateful and single-use; handing back a shared instance would
  // make every digest after the first one wrong.
  test('returns a fresh hash on every call', () => {
    delete process.env[VAR];

    const first = createCacheHash();
    const second = createCacheHash();

    expect(first).not.toBe(second);
    expect(first.update('a').digest('hex')).toEqual(second.update('a').digest('hex'));
  });

  test('is deterministic across algorithms', () => {
    for (const algorithm of ['md5', 'sha256', 'sha512']) {
      process.env[VAR] = algorithm;

      expect(createCacheHash().update('same input').digest('hex'))
        .toEqual(createCacheHash().update('same input').digest('hex'));
    }
  });
});
