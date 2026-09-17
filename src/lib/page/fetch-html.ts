export interface FetchProgress {
  attempt: number;
  attempts: number;
}

export type HtmlFetcher = (url: string, onProgress?: (progress: FetchProgress) => void) => Promise<string>;

export interface HtmlFetcherOptions {
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
  delayMs?: (waited: number) => number;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Fetches a build page's HTML without cookies. Signed in, the site renders build pages in the browser and its HTML
 * carries no build data; the signed-out page has it all in `__PRELOADED_STATE__`.
 *
 * The site sits behind bot protection that turns away a visitor it has not seen before, so a first visit can be
 * refused a few times before it goes through: the fetch waits and asks again, and spends its last attempt on the
 * visitor's own session, which the page itself was loaded with.
 */
export function createHtmlFetcher(fetchImpl: typeof fetch = (input, init) => fetch(input, init), options: HtmlFetcherOptions = {}): HtmlFetcher {
  const { attempts = 4, sleep = wait, delayMs = (waited) => 700 * 2 ** waited } = options;

  return async (url, onProgress) => {
    let failure: unknown = new Error('No attempt was made');

    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (attempt > 1) {
        onProgress?.({ attempt, attempts });
        await sleep(delayMs(attempt - 2));
      }
      const credentials = attempt === attempts && attempts > 1 ? 'include' : 'omit';
      try {
        const response = await fetchImpl(url, { credentials });
        if (response.ok) return await response.text();
        failure = new Error(`HTTP ${response.status}`);
      } catch (error) {
        failure = error;
      }
    }

    throw failure;
  };
}
