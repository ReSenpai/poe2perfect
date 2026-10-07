// Checks that the commenter portraits we link from the Mobalytics CDN are still there:
// `node --experimental-strip-types scripts/check-links.mjs`. Exits with 1 and lists the broken ones otherwise.
import { pathToFileURL } from 'node:url';

/** The links that don't answer with an image, each with the reason. */
export async function brokenLinks(urls, fetch) {
  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return `${url} — HTTP ${response.status}`;
        const type = response.headers.get('content-type') ?? '';
        if (!type.startsWith('image/')) return `${url} — ${type || 'no content type'}, not an image`;
        return null;
      } catch (error) {
        return `${url} — ${error instanceof Error ? error.message : String(error)}`;
      }
    }),
  );
  return results.filter((result) => result !== null);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { PORTRAITS } = await import('../src/lib/comments/portraits.ts');
  const broken = await brokenLinks(PORTRAITS, (url) => fetch(url, { method: 'HEAD' }));
  if (broken.length > 0) {
    console.error(`${broken.length} of ${PORTRAITS.length} portrait links are broken:\n${broken.join('\n')}`);
    process.exit(1);
  }
  console.log(`All ${PORTRAITS.length} portrait links answer with an image.`);
}
