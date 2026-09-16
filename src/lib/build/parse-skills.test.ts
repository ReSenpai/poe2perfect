import { describe, expect, it } from 'vitest';
import type { RawStaticData } from '@/lib/data/types';
import { parseSkills } from './parse-skills';
import { createStaticIndex } from './static-index';

function level(n: number, castTime: number, manaCost: number, reservation = 0) {
  return {
    bakedDescriptions: [`Explosion radius at level ${n}`],
    skillLevelStats: [
      { value: castTime, slug: 'castTime' },
      { value: manaCost, slug: 'manaCost' },
      { value: 0, slug: 'criticalStrikeChance' },
      { value: reservation, slug: 'reservation' },
    ],
  };
}

const GRENADE = {
  id: 'explosivegrenadeplayer',
  slug: 'explosivegrenadeplayer',
  isSupport: false,
  name: 'Explosive Grenade',
  icon: 'https://cdn/static-grenade.webp',
  mainDescription: 'Fire a bouncing Grenade.',
  bakedDescriptions: ['Explosion radius is (2-2.4) metres'],
  qualityBakedDescriptions: ['(0-20)% increased Cooldown Recovery Rate'],
  gemsTags: [
    { slug: 'gem-tag-strength', name: '', backedName: '' },
    { slug: 'gem-tag-attack', name: '[Attack]', backedName: 'Attack' },
    { slug: 'gem-tag-area', name: '[AoESkill|AoE]', backedName: 'AoE' },
  ],
  bakedMinMaxStatsDescriptions: [
    { value: '(1-20)', description: { name: 'Level' } },
    { value: '1.0', description: { name: 'Cast Time' } },
    { value: '(10-68) mana', description: { name: 'Mana Range' } },
  ],
  backedMinMaxRequires: [
    { value: '(1-97)', description: { name: 'Level' } },
    { value: '(0-211)', description: { name: 'Str' } },
  ],
  gemStats: [
    { value: 0, slug: 'int' },
    { value: 50, slug: 'dex' },
    { value: 50, slug: 'str' },
  ],
  statsPerLevel: [level(1, 1, 10), level(2, 1.25, 12)],
};

const MULTISHOT = {
  slug: 'supportmultishotplayertwo',
  isSupport: true,
  name: 'Multishot II',
  icon: '',
  mainDescription: 'Supports Projectile skills.',
  bakedDescriptions: ['Fires 2 additional Projectiles'],
  gemsTags: [{ slug: 'gem-tag-support', name: '[SupportGem|Support]', backedName: 'Support' }],
  gemStats: [],
  statsPerLevel: [],
};

const index = createStaticIndex({ poe2Gems: { data: [GRENADE, MULTISHOT] } } satisfies RawStaticData);

function rawGem(activeSkill: Record<string, unknown> | null, subSkills: unknown[] = []) {
  return { activeSkill, grantedByWeaponSet: null, subSkills, weaponSet: null };
}

const GRENADE_ACTIVE = {
  gemIconURL: 'https://cdn/gem-item.webp',
  gemSlug: 'explosivegrenadeplayer',
  iconURL: 'https://cdn/skill-icon.webp',
  name: 'Explosive Grenade',
  level: null,
};

describe('parseSkills', () => {
  it('describes a gem without a set level with the static ranges', () => {
    const { skills } = parseSkills({ gems: [rawGem(GRENADE_ACTIVE)] }, index);

    expect(skills[0]?.gem).toEqual({
      slug: 'explosivegrenadeplayer',
      name: 'Explosive Grenade',
      iconUrl: 'https://cdn/skill-icon.webp',
      kind: 'active',
      level: null,
      details: {
        description: 'Fire a bouncing Grenade.',
        tags: ['Attack', 'AoE'],
        stats: [
          { name: 'Level', value: '(1-20)' },
          { name: 'Cast Time', value: '1.0' },
          { name: 'Mana Range', value: '(10-68) mana' },
        ],
        effects: ['Explosion radius is (2-2.4) metres'],
        qualityEffects: ['(0-20)% increased Cooldown Recovery Rate'],
        requirements: [
          { name: 'Level', value: '(1-97)' },
          { name: 'Str', value: '(0-211)' },
        ],
        attributes: { dex: 50, str: 50 },
      },
    });
  });

  it('uses exact stats and effects at the gem level set in the build', () => {
    const { skills } = parseSkills({ gems: [rawGem({ ...GRENADE_ACTIVE, level: 2 })] }, index);

    expect(skills[0]?.gem.level).toBe(2);
    expect(skills[0]?.gem.details).toMatchObject({
      stats: [
        { name: 'Level', value: '2' },
        { name: 'Cast Time', value: '1.25 s' },
        { name: 'Mana Cost', value: '12' },
      ],
      effects: ['Explosion radius at level 2'],
    });
  });

  it('leaves out stats the site reports as zero', () => {
    const drain = {
      ...GRENADE,
      slug: 'essencedrainplayer',
      bakedMinMaxStatsDescriptions: [
        { value: '(3-20)', description: { name: 'Level' } },
        { value: '0.0', description: { name: 'Cast Time' } },
        { value: '0%', description: { name: 'Critical Strike Chance' } },
        { value: '(7-57) mana', description: { name: 'Mana Range' } },
      ],
    };
    const { skills } = parseSkills({ gems: [rawGem({ ...GRENADE_ACTIVE, gemSlug: 'essencedrainplayer' })] }, createStaticIndex({ poe2Gems: { data: [drain] } }));

    expect(skills[0]?.gem.details?.stats).toEqual([
      { name: 'Level', value: '(3-20)' },
      { name: 'Mana Range', value: '(7-57) mana' },
    ]);
  });

  it('falls back to ranges when the level has no stats', () => {
    const { skills } = parseSkills({ gems: [rawGem({ ...GRENADE_ACTIVE, level: 40 })] }, index);

    expect(skills[0]?.gem.details?.stats[0]).toEqual({ name: 'Level', value: '(1-20)' });
  });

  it('names supports from static data, the priority list, guide text labels, or the slug', () => {
    const { skills } = parseSkills(
      {
        gems: [
          rawGem(GRENADE_ACTIVE, [
            { gemSlug: 'supportmultishotplayertwo', iconURL: 'https://cdn/multishot.webp', gemType: 'SUPPORT' },
            { gemSlug: 'supportdeliberationplayer', iconURL: 'https://cdn/deliberation.webp', gemType: 'SUPPORT' },
            { gemSlug: 'supportchaosmasteryplayer', iconURL: null, gemType: 'SUPPORT' },
            { gemSlug: 'clustergrenadeplayer', iconURL: 'https://cdn/cluster.webp', gemType: 'ACTIVE' },
            { gemSlug: null },
          ]),
        ],
        priorityGems: [{ gemSlug: 'supportdeliberationplayer', name: 'Deliberation', gemType: 'SUPPORT' }],
      },
      index,
      new Map([['supportchaosmasteryplayer', 'Chaos Mastery']]),
    );

    expect(skills[0]?.supports.map((gem) => [gem.name, gem.kind, gem.iconUrl, gem.details !== null])).toEqual([
      ['Multishot II', 'support', 'https://cdn/multishot.webp', true],
      ['Deliberation', 'support', 'https://cdn/deliberation.webp', false],
      ['Chaos Mastery', 'support', null, false],
      ['Clustergrenade', 'active', 'https://cdn/cluster.webp', false],
    ]);
  });

  it('turns an unknown slug into a readable name', () => {
    const { skills } = parseSkills(
      { gems: [rawGem(GRENADE_ACTIVE, [{ gemSlug: 'supportexecuteplayerthree', gemType: 'SUPPORT' }, { gemSlug: 'supportzenithplayertwo', gemType: 'SUPPORT' }])] },
      index,
    );

    expect(skills[0]?.supports.map((gem) => gem.name)).toEqual(['Execute III', 'Zenith II']);
  });

  it('skips entries without an active skill and reads gem requirements', () => {
    const result = parseSkills({ gems: [rawGem(null), rawGem({ gemSlug: '' }), rawGem(GRENADE_ACTIVE)], gemRequirements: { dex: 60, str: 60, int: 35 } }, index);

    expect(result.skills).toHaveLength(1);
    expect(result.gemRequirements).toEqual({ str: 60, dex: 60, int: 35 });
  });

  it('works without static data', () => {
    const { skills } = parseSkills({ gems: [rawGem(GRENADE_ACTIVE)] }, createStaticIndex(null));

    expect(skills[0]?.gem).toMatchObject({ name: 'Explosive Grenade', details: null });
  });

  it('lists the gem priority with the skill each gem belongs to', () => {
    const { gemPriority } = parseSkills(
      {
        gems: [rawGem({ ...GRENADE_ACTIVE, name: 'Explosive Grenade' })],
        priorityGems: [
          { gemSlug: 'supportmultishotplayertwo', iconURL: 'https://cdn/multishot.webp', gemType: 'SUPPORT', name: 'Multishot II', parentActiveSkillGemSlug: 'explosivegrenadeplayer' },
          { gemSlug: 'clustergrenadeplayer', iconURL: null, gemType: 'ACTIVE', name: 'Cluster Grenade', parentActiveSkillGemSlug: 'clustergrenadeplayer' },
          { gemSlug: 'supportrareplayer', gemType: 'SUPPORT', name: null, parentActiveSkillGemSlug: 'unknownplayer' },
          { gemSlug: null, name: 'Broken' },
        ],
      },
      index,
    );

    expect(gemPriority.map((entry) => [entry.gem.name, entry.gem.kind, entry.gem.iconUrl, entry.gem.details !== null, entry.parentSlug, entry.parentName])).toEqual([
      ['Multishot II', 'support', 'https://cdn/multishot.webp', true, 'explosivegrenadeplayer', 'Explosive Grenade'],
      ['Cluster Grenade', 'active', null, false, 'clustergrenadeplayer', 'Cluster Grenade'],
      ['Rare', 'support', null, false, 'unknownplayer', null],
    ]);
  });

  it('returns nothing for missing skill gems', () => {
    expect(parseSkills(undefined, index)).toEqual({ skills: [], gemRequirements: null, gemPriority: [] });
  });
});
