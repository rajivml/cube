import crypto from 'crypto';

import { getEnv } from './env';

/**
 * A hash for cache keys, table versions and memoisation — never for security.
 *
 * Cube hashes with MD5 in about twenty places: compiler versions, security-context
 * hashes, query cache keys, pre-aggregation table versions, per-file schema cache
 * keys. None of them is a security primitive; they exist to detect "is this the
 * same input as last time".
 *
 * MD5 is not in the OpenSSL FIPS provider, so on a host in FIPS mode every one of
 * those calls raises `error:0308010C:digital envelope routines::unsupported` and
 * Cube cannot compile a model, let alone answer a query. Routing them through one
 * function makes the algorithm a deployment choice.
 *
 * The default stays `md5`, so nothing changes for existing deployments: a different
 * digest produces different cache keys and different pre-aggregation table names,
 * which would invalidate every cached result and rebuild every rollup once. A FIPS
 * deployment sets `CUBEJS_CACHE_DIGEST_ALGORITHM=sha256` and pays that cost knowingly.
 */
export function createCacheHash(): crypto.Hash {
  return crypto.createHash(getEnv('cacheDigestAlgorithm'));
}
