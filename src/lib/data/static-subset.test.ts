import { describe, expect, it } from 'vitest';
import { pickStaticSubset } from './static-subset';
import type { RawBuildDocument, RawStaticData } from './types';

function buildDoc(values: unknown[], content: RawBuildDocument['content'] = []): RawBuildDocument {
  return { id: 'doc', data: { name: 'Build', buildVariants: { values } }, content };
}

const VARIANT = {
  id: 'default-variant',
  skillGems: {
    gems: [
      {
        activeSkill: { gemSlug: 'contagionplayer', name: 'Contagion' },
        subSkills: [{ gemSlug: 'supportchaosmasteryplayer', gemType: 'SUPPORT' }],
      },
    ],
  },
  equipment: { helmet: { commonItem: { slug: "armour-atziri's-disdain" }, runes: [{ slug: 'soulcore-chaos' }] } },
  passiveTree: { mainTree: { selectedSlugs: ['node-1', 'node-3'] } },
};

function graphTree(groups: unknown[]) {
  return { orbits: [1, 12], radii: [0, 82], rootEdgeSlugs: ['node-9'], groups };
}

const STATIC: RawStaticData = {
  poe2Gems: {
    data: [
      { slug: 'contagionplayer', name: 'Contagion' },
      { slug: 'supportchaosmasteryplayer', name: 'Chaos Mastery' },
      { slug: 'fireballplayer', name: 'Fireball' },
    ],
  },
  poe2Armours: { data: [{ slug: "armour-atziri's-disdain" }, { slug: 'armour-other' }] },
  poe2SoulCores: { data: [{ id: 'soulcore-chaos', slug: 'soulcore-chaos' }, { id: 'soulcore-fire' }] },
  poe2Quests: { data: [{ id: 'quest-1' }, { id: 'quest-2' }] },
  poe2PassiveSkills: {
    data: [{ slug: 'passive-es' }, { slug: 'passive-life' }, { slug: 'passive-unused' }],
  },
  poe2PassiveSkillsGraph: {
    data: [
      graphTree([
        {
          slug: 'group-0',
          centerX: 1,
          centerY: 2,
          nodes: [
            { slug: 'node-1', passiveSlug: 'passive-es' },
            { slug: 'node-2', passiveSlug: 'passive-unused' },
          ],
        },
        { slug: 'group-1', centerX: 3, centerY: 4, nodes: [{ slug: 'node-4', passiveSlug: 'passive-unused' }] },
        { slug: 'group-2', centerX: 5, centerY: 6, nodes: [{ slug: 'node-3', passiveSlug: 'passive-life' }] },
      ]),
      graphTree([]),
    ],
  },
  meta: { version: '0.5.5' },
  poe2Empty: null,
};

describe('pickStaticSubset', () => {
  const subset = pickStaticSubset(STATIC, buildDoc([VARIANT]));

  it('keeps gems referenced by skills and supports only', () => {
    expect(subset.poe2Gems).toEqual({
      data: [
        { slug: 'contagionplayer', name: 'Contagion' },
        { slug: 'supportchaosmasteryplayer', name: 'Chaos Mastery' },
      ],
    });
  });

  it('keeps referenced items and socketables', () => {
    expect(subset.poe2Armours).toEqual({ data: [{ slug: "armour-atziri's-disdain" }] });
    expect(subset.poe2SoulCores).toEqual({ data: [{ id: 'soulcore-chaos', slug: 'soulcore-chaos' }] });
  });

  it('trims the passive graph to selected nodes and drops empty groups', () => {
    expect(subset.poe2PassiveSkillsGraph).toEqual({
      data: [
        graphTree([
          { slug: 'group-0', centerX: 1, centerY: 2, nodes: [{ slug: 'node-1', passiveSlug: 'passive-es' }] },
          { slug: 'group-2', centerX: 5, centerY: 6, nodes: [{ slug: 'node-3', passiveSlug: 'passive-life' }] },
        ]),
        graphTree([]),
      ],
    });
  });

  it('keeps passive skills reached through selected graph nodes', () => {
    expect(subset.poe2PassiveSkills).toEqual({ data: [{ slug: 'passive-es' }, { slug: 'passive-life' }] });
  });

  it('matches entries by id when they have no slug', () => {
    const doc = buildDoc([], [{ __typename: 'Widget', id: 'w', data: { questId: 'quest-2' } }]);

    expect(pickStaticSubset(STATIC, doc).poe2Quests).toEqual({ data: [{ id: 'quest-2' }] });
  });

  it('counts entity chips inside rich text as references', () => {
    const chip = { type: 'static-data-widget', id: 'fireballplayer', label: 'Fireball' };
    const doc = buildDoc([], [{ __typename: 'RichText', id: 'w', data: { value: { root: { children: [chip] } } } }]);

    expect(pickStaticSubset(STATIC, doc).poe2Gems).toEqual({ data: [{ slug: 'fireballplayer', name: 'Fireball' }] });
  });

  it('copies categories without a data array as they are', () => {
    expect(subset.meta).toEqual({ version: '0.5.5' });
    expect(subset.poe2Empty).toBeNull();
  });

  it('does not mutate the input', () => {
    const before = JSON.stringify(STATIC);
    pickStaticSubset(STATIC, buildDoc([VARIANT]));
    expect(JSON.stringify(STATIC)).toBe(before);
  });
});
