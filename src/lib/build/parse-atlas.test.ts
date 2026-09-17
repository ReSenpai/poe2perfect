import { describe, expect, it } from 'vitest';
import { loadFixture } from '../../../tests/fixtures/load';
import { parseAtlas } from './parse-atlas';
import { parseBuild } from './parse-build';
import { createStaticIndex } from './static-index';

const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
const INDEX = createStaticIndex(fixture.staticData);
const BUILD = parseBuild(fixture.build, fixture.staticData);
const variant = (title: string) => BUILD.variants.find((v) => v.title === title)!;

describe('parseAtlas', () => {
  it('has no atlas tree for variants the author left it out of', () => {
    expect(variant('ACT 1').atlas).toBeNull();
    expect(variant('ACT 4 - Endgame').atlas).toBeNull();
  });

  it('counts every node the author took, across the subtrees, minus the free starting node', () => {
    // Both take the free starting nodes (the atlas centre, the expedition subtree); they cost nothing.
    expect(variant('ENDGAME (FULL LIFE)').atlas?.pointCount).toBe(19);
    expect(variant('ENDGAME (LOW LIFE)').atlas?.pointCount).toBe(19);
  });

  it('groups the notables and keystones by subtree, in the order they were taken', () => {
    const atlas = variant('ENDGAME (LOW LIFE)').atlas!;

    expect(atlas.groups.map((group) => [group.id, group.label])).toEqual([['expeditionTree', 'Expedition']]);
    expect(atlas.groups[0]!.passives.map((p) => [p.name, p.kind])).toEqual([
      ['Double or Nothing', 'keystone'],
      ['Calculated Investment', 'keystone'],
      ['Buried Ambition', 'notable'],
      ['Steady Development', 'keystone'],
    ]);
  });

  it('labels each kind of subtree', () => {
    const slug = 'node-42673'; // Double or Nothing
    const atlas = parseAtlas(
      {
        mainTree: { selectedSlugs: [slug] },
        breachTree: { selectedSlugs: [slug] },
        deliriumTree: { selectedSlugs: [slug] },
        ritualTree: { selectedSlugs: [slug] },
        bossTree: { selectedSlugs: [slug] },
        pinnacleBossTree: { selectedSlugs: [slug] },
        abyssalTree: { selectedSlugs: [slug] },
        incursionTree: { selectedSlugs: [slug] },
        strangeNewTree: { selectedSlugs: [slug] },
        masters: null,
      },
      INDEX,
    );

    expect(atlas?.groups.map((group) => group.label)).toEqual(['Atlas', 'Breach', 'Delirium', 'Ritual', 'Bosses', 'Pinnacle Bosses', 'Abyss', 'Incursion', 'Strange New']);
  });

  it('has no atlas tree when nothing is taken', () => {
    expect(parseAtlas({ mainTree: { selectedSlugs: [] }, bossTree: null }, INDEX)).toBeNull();
    expect(parseAtlas(null, INDEX)).toBeNull();
  });
});
