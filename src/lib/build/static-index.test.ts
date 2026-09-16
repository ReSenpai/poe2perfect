import { describe, expect, it } from 'vitest';
import type { RawStaticData } from '@/lib/data/types';
import { createStaticIndex } from './static-index';

const STATIC: RawStaticData = {
  poe2Gems: { data: [{ slug: 'contagionplayer', name: 'Contagion' }] },
  poe2Armours: { data: [{ slug: 'armour-helmet', name: 'Helmet' }] },
  poe2Rings: { data: [{ slug: 'ring-ruby', name: 'Ruby Ring' }] },
  poe2SoulCores: { data: [{ slug: 'soulcore-iron', name: 'Iron Rune' }] },
  poe2Prefixes: { data: [{ slug: 'IncreasedLife4', bakedDescriptions: ['+(40-59) to maximum Life'] }] },
  poe2Suffixes: { data: [{ slug: 'Strength6', bakedDescriptions: ['+(25-27) to Strength'] }] },
  poe2PassiveSkills: { data: [{ slug: 'passive-es', name: 'Heavy Buffer' }] },
  poe2PassiveSkillsGraph: {
    data: [{ groups: [{ slug: 'group-0', nodes: [{ slug: 'node-1', passiveSlug: 'passive-es' }] }] }, { groups: [] }],
  },
  meta: { version: '1' },
  poe2Broken: null,
};

describe('createStaticIndex', () => {
  const index = createStaticIndex(STATIC);

  it('finds gems by slug', () => {
    expect(index.gem('contagionplayer')).toEqual({ slug: 'contagionplayer', name: 'Contagion' });
    expect(index.gem('missing')).toBeNull();
  });

  it('finds items in any item category', () => {
    expect(index.item('armour-helmet')).toMatchObject({ name: 'Helmet' });
    expect(index.item('ring-ruby')).toMatchObject({ name: 'Ruby Ring' });
  });

  it('finds socketables and affixes', () => {
    expect(index.socketable('soulcore-iron')).toMatchObject({ name: 'Iron Rune' });
    expect(index.affix('IncreasedLife4')).toMatchObject({ bakedDescriptions: ['+(40-59) to maximum Life'] });
    expect(index.affix('Strength6')).toMatchObject({ bakedDescriptions: ['+(25-27) to Strength'] });
  });

  it('resolves a passive through its tree node', () => {
    expect(index.passiveSlugOfNode('node-1')).toBe('passive-es');
    expect(index.passiveOfNode('node-1')).toEqual({ slug: 'passive-es', name: 'Heavy Buffer' });
    expect(index.passiveOfNode('node-404')).toBeNull();
  });

  it('is empty without static data', () => {
    const empty = createStaticIndex(null);

    expect(empty.available).toBe(false);
    expect(empty.gem('contagionplayer')).toBeNull();
    expect(empty.passiveOfNode('node-1')).toBeNull();
    expect(index.available).toBe(true);
  });
});
