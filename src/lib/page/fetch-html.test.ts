import { describe, expect, it, vi } from 'vitest';
import { createHtmlFetcher } from './fetch-html';

const URL = 'https://mobalytics.gg/poe-2/builds/a';

const responses = (...statuses: number[]) => {
  const queue = [...statuses];
  return vi.fn(async () => new Response('<html>build</html>', { status: queue.shift() ?? 200 }));
};

const sleep = vi.fn(async () => {});
const fetcher = (fetchImpl: typeof fetch, options = {}) => createHtmlFetcher(fetchImpl, { sleep, ...options });

describe('createHtmlFetcher', () => {
  it('asks for the page as a signed-out visitor, whose page carries the build data', async () => {
    const fetch = responses(200);

    expect(await fetcher(fetch)(URL)).toBe('<html>build</html>');
    expect(fetch).toHaveBeenCalledWith(URL, { credentials: 'omit' });
  });

  // A visitor whose first ever request to the site comes from the guide is turned away by the site's bot
  // protection until the site itself has warmed up in this browser.
  it('waits and asks again when the site turns the request away', async () => {
    const fetch = responses(403, 403, 200);

    expect(await fetcher(fetch)(URL)).toBe('<html>build</html>');
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalled();
  });

  it("uses the visitor's own session for the last attempt, since the page itself got through with it", async () => {
    const fetch = responses(403, 403, 403, 200);

    expect(await fetcher(fetch, { attempts: 4 })(URL)).toBe('<html>build</html>');
    expect(fetch).toHaveBeenLastCalledWith(URL, { credentials: 'include' });
  });

  it('gives up after the last attempt, naming the status the site answered with', async () => {
    const fetch = responses(503, 503, 503, 503);

    await expect(fetcher(fetch, { attempts: 4 })(URL)).rejects.toThrow('HTTP 503');
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('keeps the caller posted while it waits, so the guide can say what is going on', async () => {
    const progress = vi.fn();

    await fetcher(responses(403, 200))(URL, progress);

    expect(progress).toHaveBeenCalledWith({ attempt: 2, attempts: 4 });
  });
});
