/** What indexedDbCandidates reads of the content script's globals. */
export interface IdbScope {
  indexedDB: IDBFactory;
  /** Firefox only: the page's own window, which may hold a database the content script's does not see. */
  wrappedJSObject?: { indexedDB?: IDBFactory };
}

/**
 * The databases the site's game data might live in, in the order to try them. A content script shares the page's
 * storage in Chrome; Firefox can keep its own apart, and then the page's window has to be asked for its database.
 */
export function indexedDbCandidates(scope: IdbScope = globalThis as unknown as IdbScope): IDBFactory[] {
  const candidates = [scope.indexedDB, scope.wrappedJSObject?.indexedDB];
  return [...new Set(candidates.filter((factory): factory is IDBFactory => Boolean(factory)))];
}
