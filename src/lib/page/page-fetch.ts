/** What pageFetch reads of the content script's globals. */
export interface FetchScope {
  fetch: typeof fetch;
  /** Firefox only: the page's own window, whose fetch runs as the page rather than as the extension. */
  content?: { fetch: typeof fetch };
}

/**
 * The fetch that asks mobalytics as the page itself. In Chrome the content script's fetch already does; in Firefox it
 * runs as the extension, from an origin the site's bot protection has no reason to trust, so `content.fetch` is used.
 */
export function pageFetch(scope: FetchScope = globalThis as unknown as FetchScope): typeof fetch {
  const page = scope.content;
  if (page && typeof page.fetch === 'function') return page.fetch.bind(page);
  return scope.fetch.bind(scope);
}
