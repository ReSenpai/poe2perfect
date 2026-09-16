import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { readStaticData } from './static-data';

const DB_NAME = 'ngf-static-data';
const STATIC_DATA = { poe2Gems: { data: [{ slug: 'contagionplayer', name: 'Contagion' }] } };

function record(game: unknown, overrides: Record<string, unknown> = {}) {
  return { staticData: { game: { staticData: game } }, timestamp: 1789295668666, cacheVersion: 'v0.0.340', ttl: 604800000, ...overrides };
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function seed(idb: IDBFactory, entries: Record<string, unknown>, storeName = 'cache') {
  const open = idb.open(DB_NAME, 1);
  open.onupgradeneeded = () => open.result.createObjectStore(storeName);
  const db = await requestToPromise(open);
  const tx = db.transaction(storeName, 'readwrite');
  for (const [key, value] of Object.entries(entries)) tx.objectStore(storeName).put(value, key);
  await new Promise((resolve) => (tx.oncomplete = resolve));
  db.close();
}

async function databaseNames(idb: IDBFactory) {
  return (await idb.databases()).map((db) => db.name);
}

const FAST = { timeoutMs: 0, pollIntervalMs: 5 };

describe('readStaticData', () => {
  it('reads the PoE 2 static data record', async () => {
    const idb = new IDBFactory();
    await seed(idb, { 'poe|aaa': record({ other: true }), 'poe-2|bbb': record(STATIC_DATA) });

    const result = await readStaticData({ ...FAST, idb });

    expect(result).toEqual({
      ok: true,
      snapshot: { staticData: STATIC_DATA, cacheVersion: 'v0.0.340', timestamp: 1789295668666 },
    });
  });

  it('is unavailable when the database does not exist, without creating it', async () => {
    const idb = new IDBFactory();

    const result = await readStaticData({ ...FAST, idb });

    expect(result).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(await databaseNames(idb)).not.toContain(DB_NAME);
  });

  it('does not create the database when it disappears between listing and opening', async () => {
    const idb = new IDBFactory();
    const lyingIdb = Object.assign(Object.create(idb), {
      databases: async () => [{ name: DB_NAME, version: 1 }],
      open: idb.open.bind(idb),
    }) as IDBFactory;

    const result = await readStaticData({ ...FAST, idb: lyingIdb });

    expect(result).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(await databaseNames(idb)).not.toContain(DB_NAME);
  });

  it('is unavailable when only PoE 1 data is cached', async () => {
    const idb = new IDBFactory();
    await seed(idb, { 'poe|aaa': record({ other: true }) });

    expect(await readStaticData({ ...FAST, idb })).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('is unavailable when the cache store is missing', async () => {
    const idb = new IDBFactory();
    await seed(idb, {}, 'something-else');

    expect(await readStaticData({ ...FAST, idb })).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('is unavailable when the record has an unexpected shape', async () => {
    const idb = new IDBFactory();
    await seed(idb, { 'poe-2|bbb': { staticData: null } });

    expect(await readStaticData({ ...FAST, idb })).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('waits for the site to write the data', async () => {
    const idb = new IDBFactory();
    setTimeout(() => void seed(idb, { 'poe-2|bbb': record(STATIC_DATA) }), 30);

    const result = await readStaticData({ idb, timeoutMs: 1000, pollIntervalMs: 10 });

    expect(result.ok).toBe(true);
  });

  it('gives up after the timeout', async () => {
    const idb = new IDBFactory();
    const started = Date.now();

    const result = await readStaticData({ idb, timeoutMs: 60, pollIntervalMs: 10 });

    expect(result).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
  });

  it('keeps missing cache metadata as null', async () => {
    const idb = new IDBFactory();
    await seed(idb, { 'poe-2|bbb': { staticData: { game: { staticData: STATIC_DATA } } } });

    const result = await readStaticData({ ...FAST, idb });

    expect(result).toEqual({ ok: true, snapshot: { staticData: STATIC_DATA, cacheVersion: null, timestamp: null } });
  });
});
