const HOSTS = new Set(['mobalytics.gg', 'www.mobalytics.gg']);
const BUILD_PATH = /^\/poe-2\/builds\/([^/]+)\/?$/;

/** Slug of a PoE 2 build page on mobalytics.gg, or null for any other URL. */
export function getBuildSlug(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !HOSTS.has(parsed.hostname)) return null;
  return BUILD_PATH.exec(parsed.pathname)?.[1] ?? null;
}

export function isBuildPageUrl(url: string): boolean {
  return getBuildSlug(url) !== null;
}
