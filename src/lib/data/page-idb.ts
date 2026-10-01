/** What pageIndexedDb reads of the content script's globals. */
export interface IdbScope {
  indexedDB: IDBFactory;
  /** Firefox only: the page's own window, whose storage is where the site keeps its game data. */
  wrappedJSObject?: { indexedDB?: IDBFactory };
}

/**
 * The database the site's game data lives in. A content script shares the page's storage in Chrome, while Firefox
 * keeps its own apart — there the page's window has to be asked for its database.
 */
export function pageIndexedDb(scope: IdbScope = globalThis as unknown as IdbScope): IDBFactory {
  return scope.wrappedJSObject?.indexedDB ?? scope.indexedDB;
}
