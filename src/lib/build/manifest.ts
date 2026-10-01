/**
 * The manifest fields the project sets itself, per browser; WXT adds the rest (icons, content scripts, version).
 * One source for Chrome and Firefox, so the two builds cannot drift apart.
 */

/** The Firefox add-on id: fixed forever, since a new id would be a new add-on on addons.mozilla.org. */
export const FIREFOX_ID = 'poe2perfect@resenpai.dev';

/**
 * The Firefox version of a package version. addons.mozilla.org takes digits only, so a pre-release (`1.3.0-beta.1`)
 * is numbered just below the release it leads to: `1.2.999.1`. Chrome keeps the package version as it is.
 */
export function firefoxVersion(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[a-z]+\.(\d+))?$/.exec(version);
  if (!match) throw new Error(`Cannot number ${version} for Firefox: use X.Y.Z or X.Y.Z-beta.N`);

  const [major, minor, patch] = match.slice(1, 4).map(Number) as [number, number, number];
  const pre = match[4];
  if (pre === undefined) return `${major}.${minor}.${patch}`;

  const below = patch > 0 ? [major, minor, patch - 1] : minor > 0 ? [major, minor - 1, 999] : [major - 1, 999, 999];
  return [...below, Number(pre)].join('.');
}

export function manifestFor(browser: string, version?: string) {
  return {
    name: 'poe2perfect',
    description: 'A clean, tabbed view of Path of Exile 2 build guides on mobalytics.gg',
    permissions: ['storage'],
    homepage_url: 'https://github.com/ReSenpai/poe2perfect',
    ...(browser === 'firefox'
      ? {
          ...(version ? { version: firefoxVersion(version) } : {}),
          browser_specific_settings: {
            // 140: the first Firefox (and ESR) that reads data_collection_permissions, which new add-ons must declare.
            gecko: { id: FIREFOX_ID, strict_min_version: '140.0', data_collection_permissions: { required: ['none'] } },
          },
        }
      : {}),
  };
}
