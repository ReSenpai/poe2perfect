import type { RawStaticData } from './types';

export interface StaticDataSnapshot {
  staticData: RawStaticData;
  cacheVersion: string | null;
  timestamp: number | null;
}

export type StaticDataResult = { ok: true; snapshot: StaticDataSnapshot } | { ok: false; reason: 'unavailable'; message: string };

export interface ReadStaticDataOptions {
  idb?: IDBFactory;
  /** How long to wait for the site to populate its cache. */
  timeoutMs?: number;
  pollIntervalMs?: number;
}

const DB_NAME = 'ngf-static-data';
const STORE_NAME = 'cache';
const KEY_PREFIX = 'poe-2|';

/**
 * Reads the game static data the site caches in its own IndexedDB.
 * The database belongs to the site: this never creates or upgrades it.
 */
export async function readStaticData(options: ReadStaticDataOptions = {}): Promise<StaticDataResult> {
  const { idb = globalThis.indexedDB, timeoutMs = 15_000, pollIntervalMs = 500 } = options;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const snapshot = await tryRead(idb).catch(() => null);
    if (snapshot) return { ok: true, snapshot };
    if (Date.now() >= deadline) {
      return { ok: false, reason: 'unavailable', message: `No PoE 2 static data in IndexedDB "${DB_NAME}"` };
    }
    await delay(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
  }
}

async function tryRead(idb: IDBFactory): Promise<StaticDataSnapshot | null> {
  const databases = await idb.databases();
  if (!databases.some((db) => db.name === DB_NAME)) return null;

  const db = await openExisting(idb);
  if (!db) return null;
  try {
    if (!db.objectStoreNames.contains(STORE_NAME)) return null;
    const keys = await request(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAllKeys());
    const key = keys.find((k) => typeof k === 'string' && k.startsWith(KEY_PREFIX));
    if (key === undefined) return null;
    const value = await request(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key));
    return toSnapshot(value);
  } finally {
    db.close();
  }
}

/** Opens the database only if it already exists; a pending creation is aborted. */
function openExisting(idb: IDBFactory): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    const open = idb.open(DB_NAME);
    open.onupgradeneeded = () => open.transaction?.abort();
    open.onsuccess = () => {
      const db = open.result;
      // Let the site upgrade its cache without being blocked by us.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    open.onerror = (event) => {
      event.preventDefault();
      resolve(null);
    };
    open.onblocked = () => resolve(null);
  });
}

function toSnapshot(value: unknown): StaticDataSnapshot | null {
  if (!isObject(value)) return null;
  const game = isObject(value.staticData) ? value.staticData.game : undefined;
  const staticData = isObject(game) ? game.staticData : undefined;
  if (!isObject(staticData)) return null;
  return {
    staticData: staticData as RawStaticData,
    cacheVersion: typeof value.cacheVersion === 'string' ? value.cacheVersion : null,
    timestamp: typeof value.timestamp === 'number' ? value.timestamp : null,
  };
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
