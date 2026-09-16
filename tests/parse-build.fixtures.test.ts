import { describe, expect, it } from 'vitest';
import { parseBuild } from '@/lib/build/parse-build';
import { FIXTURE_SLUGS, loadFixture } from './fixtures/load';

function parseFixture(slug: (typeof FIXTURE_SLUGS)[number], withStatic = true) {
  const fixture = loadFixture(slug);
  return parseBuild(fixture.build, withStatic ? fixture.staticData : null);
}

function variant(build: ReturnType<typeof parseBuild>, title: string) {
  const found = build.variants.find((v) => v.title === title);
  if (!found) throw new Error(`No variant "${title}"`);
  return found;
}

describe('parseBuild on Chaos Dot Lich', () => {
  const build = parseFixture('chaos-dot-lich-starter-deadrabbit');

  it('reads the header and sections', () => {
    expect(build).toMatchObject({
      title: 'ED Contagion Lich League Starter (Level 1 to Endgame)',
      patch: '0.5.5',
      className: 'Witch',
      ascendancy: 'Lich',
      author: 'DEADRABB1T',
      hasStaticData: true,
    });
    expect(build.sections.map((s) => s.title)).toEqual(['Build Overview', 'How it Plays']);
    expect(build.strengths).not.toBeNull();
  });

  it('lists variants, the first one being the default', () => {
    expect(build.variants.map((v) => v.title)).toEqual(['ACT 1', 'ACT 2', 'ACT 3', 'ACT 4 - Endgame', 'ENDGAME (FULL LIFE)', 'ENDGAME (LOW LIFE)']);
    expect(build.variants.find((v) => v.id === build.defaultVariantId)?.title).toBe('ACT 1');
  });

  it('knows the skills its weapons grant', () => {
    const act1 = variant(build, 'ACT 1').equipment;
    const wand = act1.find((slot) => slot.slot === 'mainHand' && slot.weaponSet === 1)!;
    const staff = act1.find((slot) => slot.slot === 'mainHand' && slot.weaponSet === 2)!;

    expect(wand.item.grantedSkills.map((skill) => [skill.name, skill.gem?.slug, skill.gem?.details !== null])).toEqual([['Chaos Bolt', 'weapongrantedchaosboltplayer', true]]);
    expect(staff.item.grantedSkills.map((skill) => skill.name)).toEqual(['Sigil of Power']);
  });

  it("shows Atziri's Disdain with its static modifier ranges", () => {
    const helmet = variant(build, 'ENDGAME (FULL LIFE)').equipment.find((slot) => slot.slot === 'helmet');

    expect(helmet?.item).toMatchObject({
      name: "Atziri's Disdain",
      rarity: 'unique',
      modifiersSource: 'static',
      itemClassName: 'Helmets',
      properties: [{ name: 'Energy Shield', value: '62' }],
      requirements: [
        { name: 'Level', value: '40' },
        { name: 'Intelligence', value: '58' },
      ],
    });
    expect(helmet?.item.modifiers).toContain('Gain (10-15)% of maximum Life as Extra maximum Energy Shield');
    expect(helmet?.socketables.map((s) => s.name)).toEqual(['Idol of Egrin']);
  });

  it('describes skills with static gem data', () => {
    const { skills } = variant(build, 'ENDGAME (FULL LIFE)');

    expect(skills.map((s) => s.gem.name).slice(0, 3)).toEqual(['Essence Drain', 'Chaos Bolt', 'Contagion']);
    const contagion = skills.find((s) => s.gem.slug === 'contagionplayer');
    expect(contagion?.gem.details?.tags).toEqual(expect.arrayContaining(['Spell', 'AoE', 'Chaos', 'Duration']));
    expect(contagion?.gem.details).toMatchObject({
      stats: [
        { name: 'Level', value: '(1-20)' },
        { name: 'Cast Time', value: '1.0' },
        { name: 'Mana Range', value: '(8-83) mana' },
      ],
      requirements: [
        { name: 'Level', value: '(1-97)' },
        { name: 'Int', value: '(0-211)' },
      ],
      attributes: { int: 100 },
    });
    expect(skills.flatMap((s) => s.supports).every((gem) => gem.details !== null)).toBe(true);
  });

  it('resolves the entities mentioned in guide texts', () => {
    expect(build.entities.contagionplayer).toMatchObject({ kind: 'gem', gem: { name: 'Contagion' } });
    expect(build.entities['passive-ascendancywitch3notable6']).toMatchObject({ kind: 'passive', passive: { name: 'Eternal Life', kind: 'ascendancy' } });
    expect(build.entities['soulcore-soulcorechaos']).toMatchObject({ kind: 'socketable', socketable: { name: 'Soul Core of Tacati' } });
    expect(Object.keys(build.entities).length).toBeGreaterThan(30);
  });

  it('keeps the gem priority of a variant', () => {
    const { gemPriority } = variant(build, 'ENDGAME (FULL LIFE)');

    expect(gemPriority).toHaveLength(30);
    expect(gemPriority[0]).toMatchObject({ gem: { name: 'Chain II', kind: 'support' }, parentName: 'Essence Drain' });
    expect(gemPriority.every((entry) => entry.gem.details !== null)).toBe(true);
  });

  it('lists keystones and ascendancy notables', () => {
    const { passives } = variant(build, 'ENDGAME (FULL LIFE)');

    expect(passives.nodeCount).toBeGreaterThan(50);
    expect(passives.keyPassives.some((p) => p.kind === 'keystone')).toBe(true);
    expect(passives.ascendancy.map((p) => p.name)).toContain('Eternal Life');
  });
});

describe('parseBuild on Grenades Gemling', () => {
  const build = parseFixture('deadrabbit-grenades-gemling-league-starter');

  it('defaults to ACT 1 and keeps variants without notes', () => {
    expect(build).toMatchObject({ className: 'Mercenary', ascendancy: 'Gemling Legionnaire' });
    expect(build.variants.find((v) => v.id === build.defaultVariantId)?.title).toBe('ACT 1');
    expect(variant(build, 'Mid Endgame')).toMatchObject({ description: null, equipmentNotes: null });
  });

  it('uses rolled modifiers and exact gem levels of an imported character', () => {
    const uber = variant(build, 'Uber Endgame');
    const belt = uber.equipment.find((slot) => slot.slot === 'belt');
    const grenade = uber.skills.find((s) => s.gem.name === 'Explosive Grenade');

    expect(belt?.item).toMatchObject({ name: 'Headhunter', rarity: 'unique', modifiersSource: 'item' });
    expect(belt?.item.modifiers).toContain('+42 to maximum Life');
    expect(grenade?.gem.level).toBe(19);
    expect(grenade?.gem.details?.stats[0]).toEqual({ name: 'Level', value: '19' });
    expect(uber.gemRequirements).toEqual({ str: 60, dex: 60, int: 35 });
  });
});

describe('parseBuild on Gas Grenade Pathfinder', () => {
  const build = parseFixture('dreamcore-gas-grenade-pathfinder');

  it('defaults to the first variant', () => {
    expect(build).toMatchObject({ patch: '0.5', ascendancy: 'Pathfinder' });
    expect(build.defaultVariantId).toBe(build.variants[0]?.id);
    expect(build.variants[0]?.title).toBe('Endgame');
    expect(build.sections.map((s) => s.title)).toEqual(['Build Overview', 'FAQ', 'Changelog']);
  });
});

describe.each(FIXTURE_SLUGS)('parseBuild on %s', (slug) => {
  it('fills every variant with equipment and passives', () => {
    const build = parseFixture(slug);

    for (const v of build.variants) {
      expect.soft(v.equipment.length, v.title).toBeGreaterThan(0);
      expect.soft(v.passives.nodeCount, v.title).toBeGreaterThan(0);
    }
    expect(build.variants.some((v) => v.skills.length > 0)).toBe(true);
  });

  it('still parses without static data', () => {
    const build = parseFixture(slug, false);

    expect(build.hasStaticData).toBe(false);
    expect(build.variants.length).toBeGreaterThan(0);
    expect(build.variants.flatMap((v) => v.skills).every((s) => s.gem.details === null)).toBe(true);
  });
});
