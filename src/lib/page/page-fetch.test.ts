import { describe, expect, it, vi } from 'vitest';
import { pageFetch } from './page-fetch';

const response = () => new Response('<html>build</html>');

describe('pageFetch', () => {
  it('uses the content script’s own fetch where that already asks as the page', () => {
    const fetch = vi.fn(async () => response());

    void pageFetch({ fetch: fetch as unknown as typeof globalThis.fetch })('https://mobalytics.gg/poe-2/builds/a');

    expect(fetch).toHaveBeenCalledWith('https://mobalytics.gg/poe-2/builds/a');
  });

  // In Firefox a content script's fetch runs as the extension, from another origin the site may refuse.
  it('asks through the page in Firefox, where the content script would ask as the extension', () => {
    const extension = vi.fn(async () => response());
    const page = vi.fn(async () => response());

    void pageFetch({ fetch: extension as unknown as typeof globalThis.fetch, content: { fetch: page as unknown as typeof globalThis.fetch } })(
      'https://mobalytics.gg/poe-2/builds/a',
      { credentials: 'omit' },
    );

    expect(page).toHaveBeenCalledWith('https://mobalytics.gg/poe-2/builds/a', { credentials: 'omit' });
    expect(extension).not.toHaveBeenCalled();
  });

  it('falls back when the browser offers content without a fetch of its own', () => {
    const fetch = vi.fn(async () => response());

    void pageFetch({ fetch: fetch as unknown as typeof globalThis.fetch, content: {} as { fetch: typeof globalThis.fetch } })('https://mobalytics.gg/a');

    expect(fetch).toHaveBeenCalled();
  });
});
