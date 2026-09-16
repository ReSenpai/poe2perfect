import { describe, expect, it } from 'vitest';
import { parseBuild } from '@/lib/build/parse-build';
import { loadFixture } from '../../../tests/fixtures/load';
import { stageChanges } from './progression';

const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
const BUILD = parseBuild(fixture.build, fixture.staticData);
const variant = (title: string) => BUILD.variants.find((v) => v.title === title)!;
const names = (entries: { name: string }[]) => entries.map((entry) => entry.name);

describe('stageChanges', () => {
  it('lists skills and supports that come and go between stages', () => {
    const changes = stageChanges(variant('ACT 1'), variant('ACT 2'));

    expect(names(changes.addedSkills.map((skill) => skill.gem))).toEqual([]);
    expect(names(changes.removedSkills.map((skill) => skill.gem))).toEqual(['Unearth', 'Volcano']);
    expect(names(changes.addedSupports)).toEqual(['Living Lightning']);
    expect(names(changes.removedSupports)).toEqual([]);
  });

  it('counts a support at a higher tier as a new one', () => {
    const changes = stageChanges(variant('ACT 2'), variant('ACT 3'));

    expect(names(changes.addedSupports)).toContain('Magnified Area II');
    expect(names(changes.removedSupports)).toContain('Magnified Area I');
  });

  it('shows the gear that changes slot by slot, and slots filled for the first time', () => {
    const changes = stageChanges(variant('ACT 4 - Endgame'), variant('ENDGAME (FULL LIFE)'));

    expect(changes.gear.map((change) => [change.label, change.previous?.item.name ?? null, change.current?.item.name ?? null])).toEqual([
      ['Helmet', 'Beaded Circlet', "Atziri's Disdain"],
      ['Body Armour', "Hexer's Robe", 'Sacramental Robe'],
      ['Gloves', 'Jewelled Gloves', 'Gold Gloves'],
      ['Boots', 'Silk Slippers', 'Dunerunner Sandals'],
      ['Offhand', 'Antler Focus', 'Tasalian Focus'],
      ['Amulet', 'Lapis Amulet', 'Solar Amulet'],
      ['Ring 2', 'Amethyst Ring', 'Prismatic Ring'],
      ['Belt', 'Long Belt', 'Ingenuity'],
      ['Life Flask', 'Greater Life Flask', 'Ultimate Life Flask'],
      ['Mana Flask', 'Greater Mana Flask', 'Ultimate Mana Flask'],
      ['Charm 1', 'Thawing Charm', 'Nascent Hope'],
      ['Charm 2', null, 'The Fall of the Axe'],
      ['Charm 3', null, 'Stone Charm'],
    ]);
    expect(names(changes.addedSkills.map((skill) => skill.gem))).toEqual(['Chaos Bolt', 'Withering Presence', 'Sigil of Power', 'Convalescence']);
  });

  it('has no gear changes when the gear stays the same', () => {
    expect(stageChanges(variant('ACT 1'), variant('ACT 2')).gear).toEqual([]);
  });

  it('sums up the passive points and the key passives taken', () => {
    const changes = stageChanges(variant('ACT 4 - Endgame'), variant('ENDGAME (FULL LIFE)'));

    expect(changes.points).toEqual({ total: 112, delta: 31, ascendancyTotal: 9, ascendancyDelta: 4 });
    expect(names(changes.addedKeyPassives)).toEqual([
      'Dampening Shield',
      'Melding',
      'Insightfulness',
      'Zone of Control',
      'Efficient Casting',
      'Roil',
      'Ingenuity',
      'Convalescence',
      'Dependable Ward',
    ]);
    expect(names(changes.removedKeyPassives)).toEqual([]);
    expect(names(changes.addedAscendancy)).toEqual(['Eldritch Empowerment']);
  });

  it('notices points going down between variants that are alternatives', () => {
    const changes = stageChanges(variant('ENDGAME (FULL LIFE)'), variant('ENDGAME (LOW LIFE)'));

    expect(changes.points.delta).toBe(-16);
    expect(names(changes.removedKeyPassives)).toContain('Roil');
  });

  it('treats everything in the first stage as new', () => {
    const first = variant('ACT 1');
    const changes = stageChanges(null, first);

    expect(changes.addedSkills).toHaveLength(first.skills.length);
    expect(changes.gear.every((change) => change.previous === null)).toBe(true);
    expect(changes.gear).toHaveLength(first.equipment.length);
    expect(changes.points).toEqual({ total: 20, delta: 20, ascendancyTotal: 0, ascendancyDelta: 0 });
  });
});
