import { describe, expect, it } from 'vitest';
import { parseBuild } from '@/lib/build/parse-build';
import { loadFixture } from '../../../tests/fixtures/load';
import { parseModifier } from './parse-modifier';

const one = (line: string) => parseModifier(line)[0]!;

describe('parseModifier', () => {
  it('reads a flat addition', () => {
    expect(one('+60 to maximum Life')).toEqual({ stat: 'Maximum Life', kind: 'flat', value: 60, min: 60, max: 60, percent: false });
  });

  it('reads a resistance as the percentage it is', () => {
    expect(one('+16% to Fire Resistance')).toEqual({ stat: 'Fire Resistance', kind: 'flat', value: 16, min: 16, max: 16, percent: true });
  });

  it('takes the middle of a roll that is still a range, and keeps its ends', () => {
    expect(one('+(7-13)% to Chaos Resistance')).toEqual({ stat: 'Chaos Resistance', kind: 'flat', value: 10, min: 7, max: 13, percent: true });
  });

  it('tells an increase from an addition, since they add up differently', () => {
    expect(one('21% increased maximum Energy Shield')).toEqual({
      stat: 'Maximum Energy Shield',
      kind: 'increased',
      value: 21,
      min: 21,
      max: 21,
      percent: true,
    });
  });

  // A reduction is an increase the other way; one sign keeps a column summable.
  it('counts a reduction as a negative increase', () => {
    expect(one('(20-25)% reduced Charm Charges gained')).toMatchObject({ stat: 'Charm Charges gained', kind: 'increased', value: -22.5, min: -25, max: -20 });
  });

  it('keeps "more" apart from "increased", as the game does', () => {
    expect(one('40% more Damage')).toMatchObject({ stat: 'Damage', kind: 'more', value: 40 });
  });

  it('reads an attribute and a gem level', () => {
    expect(one('+(10-15) to Intelligence')).toMatchObject({ stat: 'Intelligence', value: 12.5, min: 10, max: 15, percent: false });
    expect(one('+3 to Level of all Spell Skills')).toMatchObject({ stat: 'Level of all Spell Skills', value: 3 });
  });

  it('reads added damage as the span it is', () => {
    expect(one('Adds 12 to 20 Physical Damage to Attacks')).toMatchObject({
      stat: 'Adds Physical Damage to Attacks',
      kind: 'flat',
      value: 16,
      min: 12,
      max: 20,
    });
  });

  // Anything unusual still counts: the number is kept and the wording becomes the name.
  it('falls back to the wording itself, with the number taken out', () => {
    expect(one('Regenerate 1.5% of maximum Life per second')).toMatchObject({ stat: 'Regenerate #% of maximum Life per second', value: 1.5 });
  });

  it('says nothing about a line that carries no number', () => {
    expect(parseModifier('You can apply an additional Curse')).toEqual([]);
    expect(parseModifier('Grants Skill: Chaos Bolt')).toEqual([]);
  });
});

describe('parseModifier on a real build', () => {
  const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
  const build = parseBuild(fixture.build, fixture.staticData);
  const lines = build.variants.flatMap((variant) => [
    ...variant.equipment.flatMap((slot) => [...slot.item.implicits, ...slot.item.modifiers]),
    ...[...variant.passives.keyPassives, ...variant.passives.ascendancy].flatMap((passive) => passive.effects),
  ]);

  it('reads a number out of nearly every line that has one', () => {
    const numeric = lines.filter((line) => /\d/.test(line));
    const named = numeric.filter((line) => {
      const stat = parseModifier(line)[0]?.stat;
      return stat !== undefined && !stat.includes('#');
    });

    expect(numeric.length).toBeGreaterThan(300);
    expect(named.length / numeric.length).toBeGreaterThan(0.8);
  });

  it('gathers the numbers a build is judged by', () => {
    const stats = new Set(lines.flatMap((line) => parseModifier(line).map((value) => value.stat)));

    for (const wanted of ['Maximum Life', 'Maximum Energy Shield', 'Fire Resistance', 'Chaos Resistance', 'Intelligence', 'Cast Speed']) {
      expect(stats).toContain(wanted);
    }
  });
});
