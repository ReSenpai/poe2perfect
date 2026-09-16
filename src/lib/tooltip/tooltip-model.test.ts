import { describe, expect, it } from 'vitest';
import type { Attributes, Gem, Item, Passive, Socketable } from '@/lib/build/model';
import { entityTooltip, gemTooltip, itemTooltip, passiveTooltip, socketableTooltip } from './tooltip-model';

const ITEM: Item = {
  slug: "armour-atziri's-disdain",
  name: "Atziri's Disdain",
  iconUrl: 'https://cdn/atziri.webp',
  rarity: 'unique',
  corrupted: true,
  itemClass: 'helmet',
  itemClassName: 'Helmets',
  modifiers: ['+(60-100) to maximum Mana', 'You can apply an additional Curse\nDouble Activation Delay'],
  modifiersSource: 'static',
  grantedSkills: [],
  properties: [{ name: 'Energy Shield', value: '62' }],
  requirements: [
    { name: 'Level', value: '40' },
    { name: 'Intelligence', value: '58' },
  ],
  flavourText: 'They screamed her name',
};

const RUNE: Socketable = { slug: 'soulcore-chaos', name: 'Soul Core of Tacati', iconUrl: 'https://cdn/tacati.webp', effects: ['Armour: +11% to Chaos Resistance'] };

const GEM: Gem = {
  slug: 'contagionplayer',
  name: 'Contagion',
  iconUrl: 'https://cdn/contagion.webp',
  kind: 'active',
  level: null,
  details: {
    description: 'Afflict a single enemy with a Debuff.',
    tags: ['Spell', 'AoE', 'Chaos'],
    stats: [
      { name: 'Level', value: '(1-20)' },
      { name: 'Cast Time', value: '1.0' },
    ],
    effects: ['Debuff duration is 5 seconds'],
    qualityEffects: ['(0-20)% increased Area of Effect'],
    requirements: [
      { name: 'Level', value: '(1-97)' },
      { name: 'Int', value: '(0-211)' },
    ],
    attributes: { int: 100 },
  },
};

const KEYSTONE: Passive = {
  nodeSlug: 'node-1',
  slug: 'passive-whispers',
  name: 'Whispers of Doom',
  iconUrl: 'https://cdn/whispers.webp',
  kind: 'keystone',
  effects: ['You can apply an additional Curse\nDouble Activation Delay of Curses'],
  flavourText: 'Your grandchildren will awaken screaming.',
};

describe('itemTooltip', () => {
  it('lists the skills an item grants first', () => {
    const quill: Item = { ...ITEM, grantedSkills: [{ name: 'Chaos Bolt', level: '(1-20)', gem: null }] };

    expect(itemTooltip(quill).sections[0]).toEqual({ title: 'Grants Skill', lines: ['Level (1-20) Chaos Bolt'], tone: 'effect' });
  });

  it('describes an item like the game does', () => {
    expect(itemTooltip(ITEM, [RUNE])).toEqual({
      title: "Atziri's Disdain",
      subtitle: 'Helmets',
      iconUrl: 'https://cdn/atziri.webp',
      accent: 'unique',
      tags: [],
      stats: [{ name: 'Energy Shield', value: '62' }],
      requirements: 'Level 40, Intelligence 58',
      description: null,
      sections: [
        { title: null, lines: ['+(60-100) to maximum Mana', 'You can apply an additional Curse', 'Double Activation Delay'], tone: 'mod' },
        { title: 'Sockets', lines: ['Soul Core of Tacati'], tone: 'muted' },
      ],
      note: 'Modifier values are ranges',
      flavour: 'They screamed her name',
      corrupted: true,
    });
  });

  it('keeps it short for a plain base item', () => {
    const plain: Item = { ...ITEM, name: 'Beaded Circlet', rarity: 'normal', corrupted: false, itemClassName: null, modifiers: [], modifiersSource: 'none', properties: [], requirements: [], flavourText: null };

    expect(itemTooltip(plain)).toMatchObject({ accent: 'normal', subtitle: null, requirements: null, sections: [], note: null, flavour: null });
  });

  it('shows rolled modifiers without the range note', () => {
    expect(itemTooltip({ ...ITEM, modifiersSource: 'item' }).note).toBeNull();
  });
});

describe('gemTooltip', () => {
  it('describes a skill gem with tags, stats, effects and quality', () => {
    expect(gemTooltip(GEM)).toEqual({
      title: 'Contagion',
      subtitle: 'Skill Gem',
      iconUrl: 'https://cdn/contagion.webp',
      accent: 'gem-int',
      tags: ['Spell', 'AoE', 'Chaos'],
      stats: [
        { name: 'Level', value: '(1-20)' },
        { name: 'Cast Time', value: '1.0' },
      ],
      requirements: 'Level (1-97), Int (0-211)',
      description: 'Afflict a single enemy with a Debuff.',
      sections: [
        { title: null, lines: ['Debuff duration is 5 seconds'], tone: 'effect' },
        { title: 'Additional Effects From Quality', lines: ['(0-20)% increased Area of Effect'], tone: 'muted' },
      ],
      note: null,
      flavour: null,
      corrupted: false,
    });
  });

  it('colours a gem by its main attribute', () => {
    const withAttributes = (attributes: Partial<Attributes>): Gem => ({ ...GEM, details: { ...GEM.details!, attributes } });

    expect(gemTooltip(withAttributes({ str: 50, dex: 50 })).accent).toBe('gem-str');
    expect(gemTooltip(withAttributes({ dex: 100 })).accent).toBe('gem-dex');
    expect(gemTooltip(withAttributes({})).accent).toBe('gem');
  });

  it('names support gems and survives missing details', () => {
    expect(gemTooltip({ ...GEM, kind: 'support', details: null })).toEqual({
      title: 'Contagion',
      subtitle: 'Support Gem',
      iconUrl: 'https://cdn/contagion.webp',
      accent: 'gem',
      tags: [],
      stats: [],
      requirements: null,
      description: null,
      sections: [],
      note: null,
      flavour: null,
      corrupted: false,
    });
  });
});

describe('passiveTooltip', () => {
  it('describes a keystone with its effects and flavour', () => {
    expect(passiveTooltip(KEYSTONE)).toMatchObject({
      title: 'Whispers of Doom',
      subtitle: 'Keystone',
      accent: 'keystone',
      sections: [{ title: null, lines: ['You can apply an additional Curse', 'Double Activation Delay of Curses'], tone: 'effect' }],
      flavour: 'Your grandchildren will awaken screaming.',
    });
  });

  it.each([
    ['notable', 'Notable'],
    ['ascendancy', 'Ascendancy'],
    ['small', 'Passive'],
    ['jewel-socket', 'Jewel Socket'],
  ] as const)('labels a %s passive', (kind, subtitle) => {
    expect(passiveTooltip({ ...KEYSTONE, kind })).toMatchObject({ subtitle, accent: kind === 'small' || kind === 'jewel-socket' ? 'passive' : kind });
  });
});

describe('socketableTooltip', () => {
  it('lists what the socketable does per item type', () => {
    expect(socketableTooltip(RUNE)).toMatchObject({
      title: 'Soul Core of Tacati',
      subtitle: 'Socketable',
      accent: 'socketable',
      sections: [{ title: null, lines: ['Armour: +11% to Chaos Resistance'], tone: 'effect' }],
    });
  });

  it('falls back to the slug for an unknown socketable', () => {
    expect(socketableTooltip({ slug: 'soulcore-unknown', name: null, iconUrl: null, effects: [] })).toMatchObject({ title: 'soulcore-unknown', sections: [] });
  });
});

describe('entityTooltip', () => {
  it('picks the tooltip for the entity kind', () => {
    expect(entityTooltip({ kind: 'item', item: ITEM }).title).toBe("Atziri's Disdain");
    expect(entityTooltip({ kind: 'gem', gem: GEM }).subtitle).toBe('Skill Gem');
    expect(entityTooltip({ kind: 'passive', passive: KEYSTONE }).subtitle).toBe('Keystone');
    expect(entityTooltip({ kind: 'socketable', socketable: RUNE }).subtitle).toBe('Socketable');
  });
});
