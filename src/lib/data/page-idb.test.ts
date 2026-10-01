import { describe, expect, it } from 'vitest';
import { pageIndexedDb } from './page-idb';

const factory = (name: string) => ({ name }) as unknown as IDBFactory;

describe('pageIndexedDb', () => {
  it("uses the content script's own database where that is the page's as well", () => {
    const own = factory('own');

    expect(pageIndexedDb({ indexedDB: own })).toBe(own);
  });

  // Firefox keeps a content script's storage apart from the page's; the game data lives in the page's.
  it("reaches for the page's database where the browser keeps them apart", () => {
    const own = factory('own');
    const page = factory('page');

    expect(pageIndexedDb({ indexedDB: own, wrappedJSObject: { indexedDB: page } })).toBe(page);
  });

  it('falls back when the page offers no database of its own', () => {
    const own = factory('own');

    expect(pageIndexedDb({ indexedDB: own, wrappedJSObject: {} })).toBe(own);
  });
});
