const HOSTS = new Set(['mobalytics.gg', 'www.mobalytics.gg']);
const GUIDE_PATH = /^\/poe-2\/builds\/([^/]+)\/?$/;
const PROFILE_PATH = /^\/poe-2\/profile\/([^/]+)\/builds\/([^/]+)\/?$/;
const DOCUMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A PoE 2 build page; `key` tells builds apart, e.g. for the preferences remembered per build. */
export type BuildPage =
  | { source: 'guide'; key: string; slug: string }
  | { source: 'profile'; key: string; author: string; slug: string }
  | { source: 'profile-id'; key: string; author: string; id: string };

export function parseBuildUrl(url: string): BuildPage | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !HOSTS.has(parsed.hostname)) return null;

  const slug = GUIDE_PATH.exec(parsed.pathname)?.[1];
  if (slug) return { source: 'guide', key: slug, slug };

  const [, author, name] = PROFILE_PATH.exec(parsed.pathname) ?? [];
  if (!author || !name) return null;
  const key = `${author}/${name}`;
  return DOCUMENT_ID.test(name) ? { source: 'profile-id', key, author, id: name } : { source: 'profile', key, author, slug: name };
}

export function getBuildKey(url: string): string | null {
  return parseBuildUrl(url)?.key ?? null;
}

export function isBuildPageUrl(url: string): boolean {
  return parseBuildUrl(url) !== null;
}
