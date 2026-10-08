import { describe, expect, it } from 'vitest';
import { brokenLinks } from './check-links.mjs';

const answer = (status: number, type = 'image/jpeg') => new Response(null, { status, headers: { 'content-type': type } });

describe('brokenLinks', () => {
  it('passes links that answer with an image', async () => {
    const fetch = async () => answer(200);

    expect(await brokenLinks(['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'], fetch)).toEqual([]);
  });

  it('names each link that is gone, answers with something else than an image, or fails to answer', async () => {
    const fetch = async (url: string) => {
      if (url.endsWith('gone.jpg')) return answer(404);
      if (url.endsWith('page.jpg')) return answer(200, 'text/html');
      if (url.endsWith('down.jpg')) throw new Error('getaddrinfo ENOTFOUND');
      return answer(200);
    };

    expect(await brokenLinks(['https://cdn.test/ok.jpg', 'https://cdn.test/gone.jpg', 'https://cdn.test/page.jpg', 'https://cdn.test/down.jpg'], fetch)).toEqual([
      'https://cdn.test/gone.jpg — HTTP 404',
      'https://cdn.test/page.jpg — text/html, not an image',
      'https://cdn.test/down.jpg — getaddrinfo ENOTFOUND',
    ]);
  });
});
