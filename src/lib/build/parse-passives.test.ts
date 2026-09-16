import { describe, expect, it } from 'vitest';
import type { RawStaticData } from '@/lib/data/types';
import { parsePassives } from './parse-passives';
import { createStaticIndex } from './static-index';

function passive(slug: string, name: string, flags: Partial<{ keystone: boolean; notable: boolean; ascendancy: number; jewelSocket: boolean }> = {}) {
  return {
    slug,
    name,
    icon: `https://cdn/${slug}.webp`,
    keystone: false,
    notable: false,
    jewelSocket: false,
    ascendancy: -1,
    bakedDescriptions: [`${name} effect`],
    flavourText: `${name} flavour`,
    ...flags,
  };
}

const STATIC: RawStaticData = {
  poe2PassiveSkills: {
    data: [
      passive('passive-str', 'Strength'),
      passive('passive-remorseless', 'Remorseless', { notable: true }),
      passive('passive-ci', 'Chaos Inoculation', { keystone: true }),
      passive('passive-socket', 'Jewel Socket', { jewelSocket: true }),
      passive('passive-asc-small', 'Lich small', { ascendancy: 3 }),
      passive('passive-eternal-life', 'Eternal Life', { ascendancy: 3, notable: true }),
    ],
  },
  poe2PassiveSkillsGraph: {
    data: [
      {
        groups: [
          {
            slug: 'group-0',
            nodes: [
              { slug: 'node-1', passiveSlug: 'passive-str' },
              { slug: 'node-2', passiveSlug: 'passive-remorseless' },
              { slug: 'node-3', passiveSlug: 'passive-ci' },
              { slug: 'node-4', passiveSlug: 'passive-socket' },
              { slug: 'node-10', passiveSlug: 'passive-asc-small' },
              { slug: 'node-11', passiveSlug: 'passive-eternal-life' },
            ],
          },
        ],
      },
    ],
  },
};
const index = createStaticIndex(STATIC);

describe('parsePassives', () => {
  it('counts selected nodes', () => {
    const passives = parsePassives(
      { mainTree: { selectedSlugs: ['node-1', 'node-2', 'node-3'] }, ascendancyTree: { selectedSlugs: ['node-10', 'node-11'] } },
      index,
    );

    expect(passives.nodeCount).toBe(3);
    expect(passives.ascendancyNodeCount).toBe(2);
  });

  it('lists key passives in the order of the priority list, resolved through the tree', () => {
    const passives = parsePassives(
      {
        mainTree: {
          selectedSlugs: ['node-1', 'node-2', 'node-3'],
          priorityList: [
            { slug: 'node-3', name: 'Chaos Inoculation (site)', type: 'KEY_STONE', iconURL: 'https://cdn/site-ci.webp', description: 'passive-wrong' },
            { slug: 'node-2', name: 'Remorseless', type: 'NOTABLE', iconURL: null, description: 'passive-remorseless' },
          ],
        },
      },
      index,
    );

    expect(passives.keyPassives).toEqual([
      {
        nodeSlug: 'node-3',
        slug: 'passive-ci',
        name: 'Chaos Inoculation',
        iconUrl: 'https://cdn/site-ci.webp',
        kind: 'keystone',
        effects: ['Chaos Inoculation effect'],
        flavourText: 'Chaos Inoculation flavour',
      },
      {
        nodeSlug: 'node-2',
        slug: 'passive-remorseless',
        name: 'Remorseless',
        iconUrl: 'https://cdn/passive-remorseless.webp',
        kind: 'notable',
        effects: ['Remorseless effect'],
        flavourText: 'Remorseless flavour',
      },
    ]);
  });

  it('picks selected keystones and notables when there is no priority list', () => {
    const passives = parsePassives({ mainTree: { selectedSlugs: ['node-1', 'node-2', 'node-4', 'node-3', 'node-404'] } }, index);

    expect(passives.keyPassives.map((p) => [p.name, p.kind])).toEqual([
      ['Remorseless', 'notable'],
      ['Chaos Inoculation', 'keystone'],
    ]);
  });

  it('lists ascendancy notables from the priority list or the selection', () => {
    const fromSelection = parsePassives({ ascendancyTree: { selectedSlugs: ['node-10', 'node-11'] } }, index);
    const fromPriority = parsePassives(
      { ascendancyTree: { selectedSlugs: ['node-11'], priorityList: [{ slug: 'node-11', name: 'Eternal Life', type: 'ASCENDANCY_LARGE' }] } },
      index,
    );

    expect(fromSelection.ascendancy.map((p) => [p.name, p.kind])).toEqual([['Eternal Life', 'ascendancy']]);
    expect(fromPriority.ascendancy.map((p) => p.name)).toEqual(['Eternal Life']);
  });

  it('keeps priority entries by their own name and type without static data', () => {
    const passives = parsePassives(
      {
        mainTree: {
          selectedSlugs: ['node-2'],
          priorityList: [
            { slug: 'node-2', name: 'Remorseless', type: 'NOTABLE', iconURL: 'https://cdn/r.webp', description: 'passive-remorseless' },
            { slug: 'node-9', name: 'Choice', type: 'CHOICE' },
            { slug: 'node-8', name: null, type: 'NOTABLE' },
          ],
        },
      },
      createStaticIndex(null),
    );

    expect(passives.keyPassives).toEqual([
      { nodeSlug: 'node-2', slug: 'passive-remorseless', name: 'Remorseless', iconUrl: 'https://cdn/r.webp', kind: 'notable', effects: [], flavourText: null },
      { nodeSlug: 'node-9', slug: null, name: 'Choice', iconUrl: null, kind: 'ascendancy', effects: [], flavourText: null },
    ]);
  });

  it('is empty for a missing tree', () => {
    expect(parsePassives(null, index)).toEqual({ nodeCount: 0, ascendancyNodeCount: 0, keyPassives: [], ascendancy: [] });
  });
});
