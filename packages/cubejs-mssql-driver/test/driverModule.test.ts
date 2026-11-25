import type { ConnectionPool, config as MsSQLConfig } from 'mssql';

import { MSSqlDriver } from '../src/MSSqlDriver';

/**
 * A stand-in for a node-mssql flavour. The driver calls `connect()` in its constructor, so
 * without an injected module any construction here would open a real socket — which is why
 * these tests exercise the injection path only.
 */
function stubModule() {
  const connect = jest.fn().mockResolvedValue(undefined);
  const seen: MsSQLConfig[] = [];
  class Pool {
    public connect = connect;

    public constructor(config: MsSQLConfig) {
      seen.push(config);
    }
  }
  return {
    module: { ConnectionPool: Pool as unknown as typeof ConnectionPool },
    connect,
    seen,
  };
}

describe('MSSqlDriver driverModule', () => {
  test('builds the pool from the injected flavour and connects once', () => {
    const { module, connect, seen } = stubModule();

    // eslint-disable-next-line no-new
    new MSSqlDriver({ connectionString: 'Server=db;Database=d', driverModule: module });

    expect(seen).toHaveLength(1);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  test('hands the connection settings to that flavour unchanged', () => {
    const { module, seen } = stubModule();
    const connectionString =
      'Driver={ODBC Driver 18 for SQL Server};Server=db;Trusted_Connection=Yes';

    // eslint-disable-next-line no-new
    new MSSqlDriver({ connectionString, driverModule: module });

    expect(seen[0].connectionString).toEqual(connectionString);
    expect(seen[0].pool).toMatchObject({ max: expect.any(Number), min: expect.any(Number) });
  });

  // Both are this driver's options, not node-mssql's. Leaking them surfaces as a config
  // error from inside whichever flavour was injected.
  test('does not leak driver-only options into the pool config', () => {
    const { module, seen } = stubModule();

    // eslint-disable-next-line no-new
    new MSSqlDriver({ connectionString: 'Server=db', readOnly: true, driverModule: module });

    expect(seen[0]).not.toHaveProperty('driverModule');
    expect(seen[0]).not.toHaveProperty('readOnly');
  });

  // Two connections on different flavours must not interfere: node-mssql mutates its shared
  // `base.driver` on require, so this driver takes ConnectionPool from the module it is given
  // rather than resolving through that global.
  test('keeps two instances on different flavours independent', () => {
    const a = stubModule();
    const b = stubModule();

    // eslint-disable-next-line no-new
    new MSSqlDriver({ connectionString: 'Server=a', driverModule: a.module });
    // eslint-disable-next-line no-new
    new MSSqlDriver({ connectionString: 'Server=b', driverModule: b.module });

    expect(a.seen).toHaveLength(1);
    expect(b.seen).toHaveLength(1);
    expect(a.seen[0].connectionString).toEqual('Server=a');
    expect(b.seen[0].connectionString).toEqual('Server=b');
  });
});
