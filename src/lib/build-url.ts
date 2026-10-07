const HOSTS = new Set(['mobalytics.gg', 'www.mobalytics.gg']);
const GUIDE_PATH = /^\/poe-2\/builds\/([^/]+)\/?$/;
const PROFILE_PATH = /^\/poe-2\/profile\/([^/]+)\/builds\/([^/]+)\/?$/;
/** A profile build without a slug is addressed by its document id. */
const DOCUMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A PoE 2 build page on mobalytics.gg: a guide from the site's catalogue, or a build published from a player's
 * profile, by its slug or, when it has none, by its id. `key` names the build for what is remembered per build.
 */
export type BuildRef =
  | { kind: 'guide'; key: string; slug: string }
  | { kind: 'profile'; key: string; profile: string; slug: string | null; id: string | null };

export function getBuildRef(url: string): BuildRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !HOSTS.has(parsed.hostname)) return null;

  const guide = GUIDE_PATH.exec(parsed.pathname);
  if (guide) return { kind: 'guide', key: guide[1]!, slug: guide[1]! };

  const profile = PROFILE_PATH.exec(parsed.pathname);
  if (!profile) return null;
  const [, name, build] = profile as unknown as [string, string, string];
  const byId = DOCUMENT_ID.test(build);
  // A guide keeps its slug as its key, so what readers stored for it survives; a profile slug is unique only
  // among that author's builds, so the profile goes in front.
  return { kind: 'profile', key: `${name}/${build}`, profile: name, slug: byId ? null : build, id: byId ? build : null };
}

/** The key a build is remembered by, or null for any other page. */
export function getBuildKey(url: string): string | null {
  return getBuildRef(url)?.key ?? null;
}

/** Pages the guide takes over: guides and profile builds by slug, for now; builds by id come next. */
export function isBuildPageUrl(url: string): boolean {
  const ref = getBuildRef(url);
  return ref !== null && (ref.kind === 'guide' || ref.slug !== null);
}
