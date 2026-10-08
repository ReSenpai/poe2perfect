import { describe, expect, it } from 'vitest';
import { getBuildKey, getBuildRef, isBuildPageUrl } from './build-url';

const SAMPLE =
  'https://mobalytics.gg/poe-2/builds/chaos-dot-lich-starter-deadrabbit?weaponSet=set1&ws-ngf5-f7d82102-7e77-4a44-ad24-33b67e8ae7bf=activeVariantId%2Cdefault-variant#4b46748c-2c9b-4cb5-b49e-7d4dddb609b6-equipment-4';
const ID = 'e4321b1e-aa41-4c49-855d-97ffba18f5f5';

describe('getBuildRef', () => {
  it.each([
    ['https://mobalytics.gg/poe-2/builds/chaos-dot-lich-starter-deadrabbit', 'chaos-dot-lich-starter-deadrabbit'],
    ['https://mobalytics.gg/poe-2/builds/chaos-dot-lich-starter-deadrabbit/', 'chaos-dot-lich-starter-deadrabbit'],
    [SAMPLE, 'chaos-dot-lich-starter-deadrabbit'],
    ['https://www.mobalytics.gg/poe-2/builds/some-build', 'some-build'],
  ])('reads a guide %s by its slug', (url, slug) => {
    expect(getBuildRef(url)).toEqual({ kind: 'guide', key: slug, slug });
  });

  it('reads a build published from a profile under its slug', () => {
    expect(getBuildRef('https://mobalytics.gg/poe-2/profile/some-player/builds/frost-witch#comments')).toEqual({
      kind: 'profile',
      key: 'some-player/frost-witch',
      profile: 'some-player',
      slug: 'frost-witch',
      id: null,
    });
  });

  it('reads a profile build that has no slug by its id', () => {
    expect(getBuildRef(`https://mobalytics.gg/poe-2/profile/some-player/builds/${ID}/`)).toEqual({
      kind: 'profile',
      key: `some-player/${ID}`,
      profile: 'some-player',
      slug: null,
      id: ID,
    });
  });

  it.each([
    ['builds list', 'https://mobalytics.gg/poe-2/builds'],
    ['builds list with slash', 'https://mobalytics.gg/poe-2/builds/'],
    ['builds list with filters', 'https://mobalytics.gg/poe-2/builds?class=witch'],
    ['nested path', 'https://mobalytics.gg/poe-2/builds/some-build/edit'],
    ['a profile', 'https://mobalytics.gg/poe-2/profile/some-player'],
    ["a profile's build list", 'https://mobalytics.gg/poe-2/profile/some-player/builds'],
    ["a profile's guides", 'https://mobalytics.gg/poe-2/profile/some-player/guides/some-guide'],
    ['a profile build nested path', 'https://mobalytics.gg/poe-2/profile/some-player/builds/frost-witch/edit'],
    ['PoE 1 build', 'https://mobalytics.gg/poe/builds/some-build'],
    ['PoE 1 profile build', 'https://mobalytics.gg/poe/profile/some-player/builds/some-build'],
    ['Diablo 4 build', 'https://mobalytics.gg/diablo-4/builds/some-build'],
    ['other site', 'https://example.com/poe-2/builds/some-build'],
    ['lookalike domain', 'https://mobalytics.gg.example.com/poe-2/builds/some-build'],
    ['insecure scheme', 'http://mobalytics.gg/poe-2/builds/some-build'],
    ['not a URL', 'not a url'],
  ])('returns null for %s', (_name, url) => {
    expect(getBuildRef(url)).toBeNull();
  });
});

describe('getBuildKey', () => {
  it("keeps a guide's slug as its key, so what readers remembered for it stays theirs", () => {
    expect(getBuildKey(SAMPLE)).toBe('chaos-dot-lich-starter-deadrabbit');
  });

  it("keys a profile build by its profile too: a slug is unique only among one author's builds", () => {
    expect(getBuildKey('https://mobalytics.gg/poe-2/profile/some-player/builds/frost-witch')).toBe('some-player/frost-witch');
  });

  it('is null off build pages', () => {
    expect(getBuildKey('https://mobalytics.gg/poe-2/builds')).toBeNull();
  });
});

describe('isBuildPageUrl', () => {
  it('is true for a guide', () => {
    expect(isBuildPageUrl(SAMPLE)).toBe(true);
  });

  it('is false for the builds list', () => {
    expect(isBuildPageUrl('https://mobalytics.gg/poe-2/builds')).toBe(false);
  });

  it('is true for a build published from a profile under its slug', () => {
    expect(isBuildPageUrl('https://mobalytics.gg/poe-2/profile/some-player/builds/frost-witch')).toBe(true);
  });

  it('is true for a profile build addressed by id', () => {
    expect(isBuildPageUrl(`https://mobalytics.gg/poe-2/profile/some-player/builds/${ID}`)).toBe(true);
  });
});
