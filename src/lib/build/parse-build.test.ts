import { describe, expect, it } from 'vitest';
import type { RawBuildDocument, RawWidget } from '@/lib/data/types';
import { parseBuild } from './parse-build';

const rich = (value: string) => ({ root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: value }] }] } });
const EMPTY_RICH = { root: { children: [{ type: 'paragraph', children: [] }] } };

function widget(__typename: string, id: string, data: Record<string, unknown>): RawWidget {
  return { __typename, id, data };
}

function tag(groupSlug: string, name: string, slug: string) {
  return { groupSlug, name, slug };
}

function buildDoc(overrides: { content?: RawWidget[]; data?: Record<string, unknown>; extra?: Record<string, unknown> } = {}): RawBuildDocument {
  return {
    id: 'doc-1',
    typeData: { displayMetadata: { coverImageUrlPattern: 'https://cdn/header/{{class}}-{{ascendancy}}.jpg?v4' } },
    author: { name: 'DEADRABB1T', user: { displayName: 'deadrabb1t' } },
    updatedAt: '2026-09-13T10:32:29Z',
    tags: {
      data: [
        tag('class', 'Witch', 'witch'),
        tag('ascendancy', 'Lich', 'lich'),
        tag('build-type', 'End Game', 'end-game-type'),
        tag('build-type', 'Starter', 'starter-type'),
        tag('patch', '0.5.5 FR', '0-5-rota'),
      ],
    },
    ...overrides.extra,
    data: {
      name: '[0.5.5] ED Contagion Lich League Starter',
      buildVariants: {
        values: [
          { id: 'act-1', equipment: { helmet: { commonItem: { slug: 'helmet', name: 'Rusted Greathelm' } } }, skillGems: null, passiveTree: null },
          {
            id: 'default-variant',
            equipment: null,
            skillGems: { gems: [{ activeSkill: { gemSlug: 'contagionplayer', name: 'Contagion' }, subSkills: [{ gemSlug: 'supportchaosmasteryplayer' }] }] },
            passiveTree: { mainTree: { selectedSlugs: ['node-1'] } },
          },
        ],
      },
      ...overrides.data,
    },
    content: overrides.content ?? [
      widget('NgfDocumentCmSectionAuto1V1', 'root', { childrenIds: ['section-b', 'section-a'] }),
      widget('NgfDocumentCmSectionAuto1V1', 'section-a', { childrenIds: ['text-overview', 'variants'] }),
      widget('NgfDocumentCmSectionAuto1V1', 'section-b', { childrenIds: ['text-faq', 'text-empty', 'sw', 'video'] }),
      widget('NgfDocumentCmWidgetRichTextSimplifiedV2', 'text-overview', { title: 'Build Overview', simplifiedContent: { value: rich('Overview') } }),
      widget('NgfDocumentCmWidgetRichTextSimplifiedV2', 'text-faq', { title: 'FAQ', simplifiedContent: { value: rich('FAQ') } }),
      widget('NgfDocumentCmWidgetRichTextSimplifiedV2', 'text-empty', { title: 'Changelog', simplifiedContent: { value: EMPTY_RICH } }),
      widget('NgfDocumentCmWidgetStrengthsAndWeaknessesV1', 'sw', { strengths: { value: rich('Tanky') }, weaknesses: { value: null } }),
      widget('NgfDocumentCmWidgetVideoV2', 'video', { videoUrl: 'https://youtu.be/APHc82wJtk4' }),
      widget('NgfDocumentCmWidgetContentVariantsV1', 'variants', {
        childrenVariants: [
          { id: 'act-1', title: 'ACT 1', description: { value: rich('Start with Contagion') }, childrenIds: ['eq-1', 'sg-1', 'pt-1', 'at-1'] },
          { id: 'default-variant', title: 'ENDGAME', description: { value: null }, childrenIds: ['eq-2', 'missing'] },
          { id: 'ghost', title: 'No data', description: null, childrenIds: [] },
        ],
      }),
      widget('Poe2DocumentUgWidgetEquipmentV1', 'eq-1', { descriptionPoeEquipment: { value: rich('Wand: +Level') } }),
      widget('Poe2DocumentUgWidgetSkillGemsV1', 'sg-1', { descriptionPoeSkillGems: { value: rich('Jewellers Orb Priority') } }),
      widget('Poe2DocumentUgWidgetPassiveTreeV1', 'pt-1', { descriptionPoe2PassiveTree: { value: rich('Path to Darkness') } }),
      widget('Poe2DocumentUgWidgetAtlasTreeV1', 'at-1', { descriptionPoe2AtlasTree: { value: rich('Rush Strongboxes') } }),
      widget('Poe2DocumentUgWidgetEquipmentV1', 'eq-2', { descriptionPoeEquipment: { value: null } }),
      widget('NgfDocumentCmWidgetRichTextSimplifiedV2', 'text-orphan', {
        title: 'Orphan',
        simplifiedContent: { value: { root: { children: [{ type: 'static-data-widget', id: 'supportchaosmasteryplayer', label: 'Chaos Mastery' }] } } },
      }),
    ],
  };
}

describe('parseBuild entities', () => {
  const chip = (id: string, groupId: string) => ({ type: 'static-data-widget', id, label: id, groupId });
  const doc = buildDoc({
    content: [
      widget('NgfDocumentCmWidgetRichTextSimplifiedV2', 'text', {
        title: 'Overview',
        simplifiedContent: {
          value: {
            root: {
              children: [
                {
                  type: 'paragraph',
                  children: [
                    chip('contagionplayer', 'activeSkillGems'),
                    chip("armour-atziri's-disdain", 'armours'),
                    chip('passive-eternal-life', 'passiveSkills'),
                    chip('soulcore-chaos', 'soulCores'),
                    chip('supportremovedplayer', 'supportSkillGems'),
                  ],
                },
              ],
            },
          },
        },
      }),
    ],
  });
  const staticData = {
    poe2Gems: { data: [{ slug: 'contagionplayer', name: 'Contagion', mainDescription: 'Afflict an enemy.', gemsTags: [] }] },
    poe2Armours: { data: [{ slug: "armour-atziri's-disdain", name: "Atziri's Disdain", isUnique: true, icon: 'https://cdn/atziri.webp', bakedDescriptions: ['+(60-100) to maximum Mana'] }] },
    poe2PassiveSkills: { data: [{ slug: 'passive-eternal-life', name: 'Eternal Life', ascendancy: 3, notable: true, bakedDescriptions: ['Life cannot change'], flavourText: 'Forever.' }] },
    poe2SoulCores: { data: [{ slug: 'soulcore-chaos', name: 'Soul Core of Tacati', icon: 'https://cdn/tacati.webp', bakedDescriptions: ['Armour: +11% to Chaos Resistance'] }] },
  };

  it('resolves entity chips in guide texts through static data', () => {
    const { entities } = parseBuild(doc, staticData);

    expect(entities.contagionplayer).toMatchObject({ kind: 'gem', gem: { name: 'Contagion', kind: 'active', details: { description: 'Afflict an enemy.' } } });
    expect(entities["armour-atziri's-disdain"]).toMatchObject({
      kind: 'item',
      item: { name: "Atziri's Disdain", rarity: 'unique', iconUrl: 'https://cdn/atziri.webp', modifiers: ['+(60-100) to maximum Mana'] },
    });
    expect(entities['passive-eternal-life']).toEqual({
      kind: 'passive',
      passive: { nodeSlug: null, slug: 'passive-eternal-life', name: 'Eternal Life', iconUrl: null, kind: 'ascendancy', effects: ['Life cannot change'], flavourText: 'Forever.' },
    });
    expect(entities['soulcore-chaos']).toEqual({
      kind: 'socketable',
      socketable: { slug: 'soulcore-chaos', name: 'Soul Core of Tacati', iconUrl: 'https://cdn/tacati.webp', effects: ['Armour: +11% to Chaos Resistance'] },
    });
  });

  it('leaves out entities missing from static data, or all of them without it', () => {
    expect(parseBuild(doc, staticData).entities.supportremovedplayer).toBeUndefined();
    expect(parseBuild(doc, null).entities).toEqual({});
  });
});

describe('parseBuild', () => {
  const build = parseBuild(buildDoc(), null);

  it('reads the header', () => {
    expect(build).toMatchObject({
      id: 'doc-1',
      name: '[0.5.5] ED Contagion Lich League Starter',
      title: 'ED Contagion Lich League Starter',
      patch: '0.5.5',
      className: 'Witch',
      ascendancy: 'Lich',
      headerImageUrl: 'https://cdn/header/witch-lich.jpg?v4',
      buildTypes: ['End Game', 'Starter'],
      author: 'DEADRABB1T',
      updatedAt: '2026-09-13T10:32:29Z',
      videoUrl: 'https://youtu.be/APHc82wJtk4',
      hasStaticData: false,
    });
  });

  it('takes the patch from tags when the name has no marker', () => {
    const parsed = parseBuild(buildDoc({ data: { name: 'Gas Grenade Pathfinder' } }), null);

    expect(parsed).toMatchObject({ title: 'Gas Grenade Pathfinder', patch: '0.5.5 FR' });
  });

  it('lists non-empty text sections in page layout order', () => {
    expect(build.sections.map((s) => [s.id, s.title])).toEqual([
      ['text-faq', 'FAQ'],
      ['text-overview', 'Build Overview'],
      ['text-orphan', 'Orphan'],
    ]);
    expect(build.sections[0]?.content).toEqual(rich('FAQ'));
  });

  it('reads strengths and weaknesses', () => {
    expect(build.strengths).toEqual(rich('Tanky'));
    expect(build.weaknesses).toBeNull();
  });

  it('builds variants in guide order with their notes', () => {
    expect(build.variants.map((v) => [v.id, v.title])).toEqual([
      ['act-1', 'ACT 1'],
      ['default-variant', 'ENDGAME'],
    ]);
    expect(build.variants[0]).toMatchObject({
      description: rich('Start with Contagion'),
      equipmentNotes: rich('Wand: +Level'),
      skillNotes: rich('Jewellers Orb Priority'),
      passiveNotes: rich('Path to Darkness'),
      atlasNotes: rich('Rush Strongboxes'),
    });
    expect(build.variants[1]).toMatchObject({ description: null, equipmentNotes: null, skillNotes: null, passiveNotes: null, atlasNotes: null });
  });

  it('parses variant equipment, skills and passives', () => {
    expect(build.variants[0]?.equipment.map((slot) => slot.item.name)).toEqual(['Rusted Greathelm']);
    expect(build.variants[1]?.skills[0]?.gem.name).toBe('Contagion');
    expect(build.variants[1]?.passives.nodeCount).toBe(1);
  });

  it('names supports from entity chips in guide texts', () => {
    expect(build.variants[1]?.skills[0]?.supports[0]?.name).toBe('Chaos Mastery');
  });

  it('defaults to the first variant, like the site does', () => {
    expect(build.defaultVariantId).toBe('act-1');
  });

  it('falls back to raw build variants when the guide has no variants widget', () => {
    const parsed = parseBuild(buildDoc({ content: [] }), null);

    expect(parsed.variants.map((v) => [v.id, v.title])).toEqual([
      ['act-1', 'Variant 1'],
      ['default-variant', 'Variant 2'],
    ]);
    expect(parsed.sections).toEqual([]);
    expect(parsed.videoUrl).toBeNull();
  });

  it('survives a document with almost nothing in it', () => {
    const parsed = parseBuild({ id: 'x', data: { name: 'Bare' }, content: [] }, null);

    expect(parsed).toMatchObject({
      title: 'Bare',
      patch: null,
      className: null,
      ascendancy: null,
      headerImageUrl: null,
      buildTypes: [],
      author: null,
      variants: [],
      defaultVariantId: null,
    });
  });
});
