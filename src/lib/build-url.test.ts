import { describe, expect, it } from 'vitest';
import { getBuildKey, isBuildPageUrl, parseBuildUrl } from './build-url';

const SAMPLE =
  'https://mobalytics.gg/poe-2/builds/chaos-dot-lich-starter-deadrabbit?weaponSet=set1&ws-ngf5-f7d82102-7e77-4a44-ad24-33b67e8ae7bf=activeVariantId%2Cdefault-variant#4b46748c-2c9b-4cb5-b49e-7d4dddb609b6-equipment-4';
const PROFILE_ID = 'https://mobalytics.gg/poe-2/profile/fierce-golem-xc5lul/builds/e4321b1e-aa41-4c49-855d-97ffba18f5f5';
const PROFILE_SLUG = 'https://mobalytics.gg/poe-2/profile/gl1tch3d/builds/gl1tch3d-s-blacial-golt';

describe('parseBuildUrl', () => {
  it('reads a featured guide', () => {
    expect(parseBuildUrl(SAMPLE)).toEqual({ source: 'guide', key: 'chaos-dot-lich-starter-deadrabbit', slug: 'chaos-dot-lich-starter-deadrabbit' });
  });

  it('reads a profile build named by its slug', () => {
    expect(parseBuildUrl(`${PROFILE_SLUG}?weaponSet=set1#gear`)).toEqual({
      source: 'profile',
      key: 'gl1tch3d/gl1tch3d-s-blacial-golt',
      author: 'gl1tch3d',
      slug: 'gl1tch3d-s-blacial-golt',
    });
  });

  it('reads a profile build named by its id, which the site never renders into the HTML', () => {
    expect(parseBuildUrl(`${PROFILE_ID}/`)).toEqual({
      source: 'profile-id',
      key: 'fierce-golem-xc5lul/e4321b1e-aa41-4c49-855d-97ffba18f5f5',
      author: 'fierce-golem-xc5lul',
      id: 'e4321b1e-aa41-4c49-855d-97ffba18f5f5',
    });
  });
});

describe('getBuildKey', () => {
  it.each([
    ['https://mobalytics.gg/poe-2/builds/chaos-dot-lich-starter-deadrabbit', 'chaos-dot-lich-starter-deadrabbit'],
    ['https://mobalytics.gg/poe-2/builds/chaos-dot-lich-starter-deadrabbit/', 'chaos-dot-lich-starter-deadrabbit'],
    [SAMPLE, 'chaos-dot-lich-starter-deadrabbit'],
    ['https://www.mobalytics.gg/poe-2/builds/some-build', 'some-build'],
    [PROFILE_SLUG, 'gl1tch3d/gl1tch3d-s-blacial-golt'],
    [PROFILE_ID, 'fierce-golem-xc5lul/e4321b1e-aa41-4c49-855d-97ffba18f5f5'],
  ])('returns the key for build page %s', (url, key) => {
    expect(getBuildKey(url)).toBe(key);
  });

  it.each([
    ['builds list', 'https://mobalytics.gg/poe-2/builds'],
    ['builds list with slash', 'https://mobalytics.gg/poe-2/builds/'],
    ['builds list with filters', 'https://mobalytics.gg/poe-2/builds?class=witch'],
    ['nested path', 'https://mobalytics.gg/poe-2/builds/some-build/edit'],
    ['profile', 'https://mobalytics.gg/poe-2/profile/gl1tch3d'],
    ['profile builds list', 'https://mobalytics.gg/poe-2/profile/gl1tch3d/builds'],
    ['nested profile path', `${PROFILE_SLUG}/edit`],
    ['PoE 1 build', 'https://mobalytics.gg/poe/builds/some-build'],
    ['PoE 1 profile build', 'https://mobalytics.gg/poe/profile/someone/builds/some-build'],
    ['Diablo 4 build', 'https://mobalytics.gg/diablo-4/builds/some-build'],
    ['other site', 'https://example.com/poe-2/builds/some-build'],
    ['lookalike domain', 'https://mobalytics.gg.example.com/poe-2/builds/some-build'],
    ['insecure scheme', 'http://mobalytics.gg/poe-2/builds/some-build'],
    ['not a URL', 'not a url'],
  ])('returns null for %s', (_name, url) => {
    expect(getBuildKey(url)).toBeNull();
  });
});

describe('isBuildPageUrl', () => {
  it('is true for a build page', () => {
    expect(isBuildPageUrl(SAMPLE)).toBe(true);
  });

  it('is true for a profile build', () => {
    expect(isBuildPageUrl(PROFILE_ID)).toBe(true);
  });

  it('is false for the builds list', () => {
    expect(isBuildPageUrl('https://mobalytics.gg/poe-2/builds')).toBe(false);
  });
});
