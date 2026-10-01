import { describe, expect, it } from 'vitest';
import { indexedDbCandidates } from './page-idb';

const factory = (name: string) => ({ name }) as unknown as IDBFactory;

describe('indexedDbCandidates', () => {
  it("offers the content script's own database where that is the page's as well", () => {
    const own = factory('own');

    expect(indexedDbCandidates({ indexedDB: own })).toEqual([own]);
  });

  // Firefox may keep a content script's storage apart from the page's, and the game data lives in the page's.
  it("offers the page's database too, for browsers that keep the two apart", () => {
    const own = factory('own');
    const page = factory('page');

    expect(indexedDbCandidates({ indexedDB: own, wrappedJSObject: { indexedDB: page } })).toEqual([own, page]);
  });

  it('names each database once, however many ways it is reached', () => {
    const shared = factory('shared');

    expect(indexedDbCandidates({ indexedDB: shared, wrappedJSObject: { indexedDB: shared } })).toEqual([shared]);
  });

  it('copes with a page that offers no database of its own', () => {
    const own = factory('own');

    expect(indexedDbCandidates({ indexedDB: own, wrappedJSObject: {} })).toEqual([own]);
  });
});
