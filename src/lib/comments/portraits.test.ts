import { describe, expect, it } from 'vitest';
import { PORTRAITS, portraitFor } from './portraits';

describe('PORTRAITS', () => {
  it("holds the site's own portraits of every playable class and ascendancy, each once", () => {
    expect(PORTRAITS).toHaveLength(30);
    expect(new Set(PORTRAITS).size).toBe(30);
    for (const url of PORTRAITS) expect(url).toMatch(/^https:\/\/cdn\.mobalytics\.gg\/assets\/poe-2\/images\/game\/(classes|ascendancies)\/icon\/[a-z0-9-]+\.jpg$/);
    expect(PORTRAITS).toContain('https://cdn.mobalytics.gg/assets/poe-2/images/game/classes/icon/witch.jpg');
    expect(PORTRAITS).toContain('https://cdn.mobalytics.gg/assets/poe-2/images/game/ascendancies/icon/poe-2-lich.jpg');
  });
});

describe('portraitFor', () => {
  it('always gives the same account the same portrait', () => {
    expect(portraitFor('acc-frost')).toBe(portraitFor('acc-frost'));
    expect(PORTRAITS).toContain(portraitFor('acc-frost'));
  });

  it('spreads accounts over the whole set', () => {
    const picked = new Set(Array.from({ length: 300 }, (_, i) => portraitFor(`account-${i}`)));

    expect(picked.size).toBeGreaterThan(25);
  });

  it('gives a portrait even without an id', () => {
    expect(PORTRAITS).toContain(portraitFor(''));
  });
});
