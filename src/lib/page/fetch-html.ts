/**
 * Fetches a build page's HTML without cookies. Signed in, the site renders build pages in the browser and its HTML
 * carries no build data; the signed-out page has it all in `__PRELOADED_STATE__`.
 */
export function createHtmlFetcher(fetchImpl: typeof fetch = (input, init) => fetch(input, init)): (url: string) => Promise<string> {
  return async (url) => {
    const response = await fetchImpl(url, { credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  };
}
