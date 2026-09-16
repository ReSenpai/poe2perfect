import { describe, expect, it, vi } from 'vitest';
import { createHtmlFetcher } from './fetch-html';

describe('createHtmlFetcher', () => {
  it('asks for the page as a signed-out visitor, whose page carries the build data', async () => {
    const fetch = vi.fn(async () => new Response('<html>build</html>', { status: 200 }));

    expect(await createHtmlFetcher(fetch)('https://mobalytics.gg/poe-2/builds/a')).toBe('<html>build</html>');
    expect(fetch).toHaveBeenCalledWith('https://mobalytics.gg/poe-2/builds/a', { credentials: 'omit' });
  });

  it('reports a failed response with its status', async () => {
    const fetch = vi.fn(async () => new Response('nope', { status: 503 }));

    await expect(createHtmlFetcher(fetch)('https://mobalytics.gg/poe-2/builds/a')).rejects.toThrow('HTTP 503');
  });
});
