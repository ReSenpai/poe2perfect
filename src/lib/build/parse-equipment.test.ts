import { describe, expect, it } from 'vitest';
import type { RawStaticData } from '@/lib/data/types';
import { parseEquipment } from './parse-equipment';
import { createStaticIndex } from './static-index';

function commonItem(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'armour-fourbodyint6endgame',
    isUnique: false,
    isImported: null,
    iconURL: 'https://cdn/body.webp',
    name: 'Flowing Raiment',
    itemClassSlug: 'body-armour',
    modifiers: null,
    explicitDescriptions: [],
    prefixes: null,
    suffixes: null,
    requirements: null,
    stats: [],
    poe2TradeRequest: { query: '{}' },
    ...overrides,
  };
}

const STATIC: RawStaticData = {
  poe2Armours: {
    data: [
      {
        slug: "armour-atziri's-disdain",
        name: "Atziri's Disdain",
        isUnique: true,
        flavourText: 'They screamed her name',
        bakedDescriptions: ['+(60-100) to maximum Mana', ''],
        baseItemType: {
          itemClass: { name: 'Helmets', slug: 'helmet' },
          itemRequiredStats: [
            { value: 40, slug: 'level', stat: { name: 'Level' } },
            { value: 0, slug: 'str', stat: { name: 'Strength' } },
            { value: 58, slug: 'int', stat: { name: 'Intelligence' } },
          ],
        },
        stats: [
          { value: 0, slug: 'armour', stat: { name: 'Armour' } },
          { value: 62, slug: 'energyShield', stat: { name: 'Energy Shield' } },
        ],
      },
    ],
  },
  poe2Rings: {
    data: [
      {
        slug: 'ring-fourring6',
        name: 'Amethyst Ring',
        isUnique: false,
        bakedDescriptions: [''],
        baseItemType: { itemClass: { name: 'Rings', slug: 'ring' }, bakedDescriptions: ['Armour: +(7-13)% to Chaos Resistance'] },
      },
    ],
  },
  poe2Amulets: {
    data: [
      {
        slug: 'amulet-fouramulet5',
        name: 'Lapis Amulet',
        isUnique: false,
        bakedDescriptions: [''],
        baseItemType: {
          itemClass: { name: 'Amulets', slug: 'amulet' },
          bakedDescriptions: ['Armour: Wand or Staff: Martial Weapon: All: +(10-15) to Intelligence'],
        },
      },
    ],
  },
  poe2Weapons: {
    data: [
      { slug: 'weapon-fourwand1', name: 'Withered Wand', isUnique: false, bakedDescriptions: [''], baseItemType: { bakedDescriptions: ['Grants Skill: Chaos Bolt'] } },
      {
        slug: 'weapon-wicked-quill',
        name: 'The Wicked Quill',
        isUnique: true,
        bakedDescriptions: ['Grants Skill: Level (1-20) Chaos Bolt', '+10 to Dexterity'],
        baseItemType: { bakedDescriptions: ['Grants Skill: Chaos Bolt'] },
      },
      { slug: 'weapon-mystery', name: 'Mystery Staff', isUnique: false, baseItemType: { bakedDescriptions: ['Grants Skill: Forgotten Spell'] } },
    ],
  },
  poe2Gems: {
    data: [
      { slug: 'chaosboltplayer', name: 'Chaos Bolt', icon: 'https://cdn/chaos-bolt.webp' },
      { slug: 'weapongrantedchaosboltplayer', name: 'Chaos Bolt', icon: 'https://cdn/granted-chaos-bolt.webp' },
    ],
  },
  poe2Prefixes: { data: [{ slug: 'IncreasedLife4', bakedDescriptions: ['+(40-59) to maximum Life'] }] },
  poe2Suffixes: { data: [{ slug: 'ColdResist2', bakedDescriptions: ['+(11-15)% to Cold Resistance'] }] },
  poe2SoulCores: {
    data: [{ slug: 'soulcore-runeenhance', name: 'Iron Rune', icon: 'https://cdn/iron.webp', bakedDescriptions: ['Armour: 20% increased Armour'] }],
  },
};
const index = createStaticIndex(STATIC);

describe('parseEquipment', () => {
  it('lists filled slots in display order, weapons per set', () => {
    const { slots } = parseEquipment(
      {
        boots: { commonItem: commonItem({ slug: 'boots', name: 'Boots' }) },
        helmet: { commonItem: commonItem({ slug: 'helmet', name: 'Helmet' }), runes: null },
        mainHand: { set1: { commonItem: commonItem({ slug: 'wand', name: 'Wand' }), runes: null }, set2: { commonItem: commonItem({ slug: 'staff', name: 'Staff' }) } },
        offHand: { set1: { commonItem: null, providedSkill: null, runes: null }, set2: null },
        extraRing: null,
        belt: { commonItem: null },
        priorityList: [],
        chakras: null,
      },
      index,
    );

    expect(slots.map((s) => [s.slot, s.weaponSet, s.item.name])).toEqual([
      ['helmet', null, 'Helmet'],
      ['boots', null, 'Boots'],
      ['mainHand', 1, 'Wand'],
      ['mainHand', 2, 'Staff'],
    ]);
  });

  it('uses rolled modifiers and properties of an imported item', () => {
    const { slots } = parseEquipment(
      {
        amulet: {
          commonItem: commonItem({
            slug: 'amulet-fouramulet6',
            name: 'Lunar Amulet',
            itemClassSlug: 'amulet',
            modifiers: ['Corrupted'],
            explicitDescriptions: [
              { description: '+83 to maximum Energy Shield', modifiers: null, mustHave: false },
              { description: '+103 to maximum Life', modifiers: null, mustHave: false },
            ],
            prefixes: [{ slug: 'IncreasedLife4' }, { slug: 'A' }],
            suffixes: [{ slug: 'ColdResist2' }, { slug: 'B' }],
            requirements: [{ name: 'Level', value: '64' }],
            stats: [{ name: 'Item Level', value: '82' }],
          }),
        },
      },
      index,
    );

    expect(slots[0]?.item).toEqual({
      slug: 'amulet-fouramulet6',
      name: 'Lunar Amulet',
      iconUrl: 'https://cdn/body.webp',
      rarity: 'rare',
      corrupted: true,
      itemClass: 'amulet',
      itemClassName: null,
      modifiers: ['+83 to maximum Energy Shield', '+103 to maximum Life'],
      modifiersSource: 'item',
      grantedSkills: [],
      implicits: [],
      tradeUrl: 'https://www.pathofexile.com/trade2/search/?q=%7B%7D',
      properties: [{ name: 'Item Level', value: '82' }],
      requirements: [{ name: 'Level', value: '64' }],
      flavourText: null,
    });
  });

  it('falls back to affix ranges when only affixes are known', () => {
    const { slots } = parseEquipment(
      { body: { commonItem: commonItem({ prefixes: [{ slug: 'IncreasedLife4' }], suffixes: [{ slug: 'ColdResist2' }, { slug: 'Unknown' }] }) } },
      index,
    );

    expect(slots[0]?.item).toMatchObject({
      rarity: 'rare',
      modifiers: ['+(40-59) to maximum Life', '+(11-15)% to Cold Resistance'],
      modifiersSource: 'affixes',
    });
  });

  it('counts at most one prefix and one suffix as magic', () => {
    const { slots } = parseEquipment(
      {
        flask1: {
          commonItem: commonItem({
            explicitDescriptions: [{ description: '61% increased Recovery rate' }, { description: '58% increased Charges' }],
            prefixes: [{ slug: 'FlaskIncreasedRecoverySpeed5' }],
            suffixes: [{ slug: 'FlaskExtraCharges5' }],
          }),
        },
      },
      index,
    );

    expect(slots[0]?.item).toMatchObject({ rarity: 'magic', modifiersSource: 'item' });
  });

  it("takes a unique's modifiers, base properties and requirements from static data", () => {
    const { slots } = parseEquipment(
      { helmet: { commonItem: commonItem({ slug: "armour-atziri's-disdain", name: "Atziri's Disdain", isUnique: true }) } },
      index,
    );

    expect(slots[0]?.item).toMatchObject({
      rarity: 'unique',
      modifiers: ['+(60-100) to maximum Mana'],
      modifiersSource: 'static',
      flavourText: 'They screamed her name',
      itemClassName: 'Helmets',
      properties: [{ name: 'Energy Shield', value: '62' }],
      requirements: [
        { name: 'Level', value: '40' },
        { name: 'Intelligence', value: '58' },
      ],
    });
  });

  it('lists the skill a weapon base grants, with the gem the weapon version of it', () => {
    const { slots } = parseEquipment({ mainHand: { set1: { commonItem: commonItem({ slug: 'weapon-fourwand1', name: 'Withered Wand' }) } } }, index);

    expect(slots[0]?.item.grantedSkills).toMatchObject([
      { name: 'Chaos Bolt', level: null, gem: { slug: 'weapongrantedchaosboltplayer', name: 'Chaos Bolt', iconUrl: 'https://cdn/granted-chaos-bolt.webp' } },
    ]);
  });

  it("keeps a unique's granted skill with its level once, out of its modifiers", () => {
    const { slots } = parseEquipment(
      { mainHand: { set1: { commonItem: commonItem({ slug: 'weapon-wicked-quill', name: 'The Wicked Quill', isUnique: true }) } } },
      index,
    );

    expect(slots[0]?.item.grantedSkills).toMatchObject([{ name: 'Chaos Bolt', level: '(1-20)' }]);
    expect(slots[0]?.item.modifiers).toEqual(['+10 to Dexterity']);
  });

  it('names a granted skill the game data has no gem for', () => {
    const { slots } = parseEquipment({ mainHand: { set1: { commonItem: commonItem({ slug: 'weapon-mystery', name: 'Mystery Staff' }) } } }, index);

    expect(slots[0]?.item.grantedSkills).toEqual([{ name: 'Forgotten Spell', level: null, gem: null }]);
  });

  // What the base item gives on its own: the resistance on a ring, the spirit on an amulet.
  it('keeps the implicit of the base item, which is half the reason the slot is picked', () => {
    const { slots } = parseEquipment({ leftRing: { commonItem: commonItem({ slug: 'ring-fourring6', name: 'Amethyst Ring', itemClassSlug: 'ring' }) } }, index);

    expect(slots[0]?.item.implicits).toEqual(['+(7-13)% to Chaos Resistance']);
  });

  it('drops the labels the site leaves in front of an implicit', () => {
    const { slots } = parseEquipment({ amulet: { commonItem: commonItem({ slug: 'amulet-fouramulet5', name: 'Lapis Amulet', itemClassSlug: 'amulet' }) } }, index);

    expect(slots[0]?.item.implicits).toEqual(['+(10-15) to Intelligence']);
  });

  it('leaves a granted skill out of the implicits, since it is shown on its own', () => {
    const { slots } = parseEquipment({ mainHand: { set1: { commonItem: commonItem({ slug: 'weapon-fourwand1', name: 'Withered Wand', itemClassSlug: 'wand' }) } } }, index);

    expect(slots[0]?.item.implicits).toEqual([]);
    expect(slots[0]?.item.grantedSkills.map((skill) => skill.name)).toEqual(['Chaos Bolt']);
  });

  it('builds the trade search link the site offers for the item', () => {
    const { slots } = parseEquipment(
      {
        body: {
          commonItem: commonItem({
            poe2TradeRequest: { query: '{"query":{"status":{"option":"securable"}}}', currentLeague: 'Forbidden Rites' },
          }),
        },
      },
      index,
    );

    expect(slots[0]?.item.tradeUrl).toBe(
      'https://www.pathofexile.com/trade2/search/Forbidden%20Rites?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22securable%22%7D%7D%7D',
    );
  });

  it('has no trade link when the site gives no search for the item', () => {
    const { slots } = parseEquipment({ body: { commonItem: commonItem({ poe2TradeRequest: null }) } }, index);

    expect(slots[0]?.item.tradeUrl).toBeNull();
  });

  it('treats a base item without modifiers as normal', () => {
    const { slots } = parseEquipment({ body: { commonItem: commonItem() } }, index);

    expect(slots[0]?.item).toMatchObject({ rarity: 'normal', modifiers: [], modifiersSource: 'none', grantedSkills: [] });
  });

  it('resolves socketables, keeping unknown ones by slug', () => {
    const { slots } = parseEquipment(
      {
        body: {
          commonItem: commonItem(),
          runes: [
            { slug: 'soulcore-runeenhance', iconUrl: 'https://cdn/socket-filled.avif' },
            { slug: 'soulcore-unknown', iconUrl: 'https://cdn/socket-filled.avif' },
            null,
          ],
        },
      },
      index,
    );

    expect(slots[0]?.socketables).toEqual([
      { slug: 'soulcore-runeenhance', name: 'Iron Rune', iconUrl: 'https://cdn/iron.webp', effects: ['Armour: 20% increased Armour'] },
      { slug: 'soulcore-unknown', name: null, iconUrl: 'https://cdn/socket-filled.avif', effects: [] },
    ]);
  });

  it('lists priority items, skipping excluded ones', () => {
    const { itemPriority } = parseEquipment(
      {
        priorityList: [
          { iconURL: 'https://cdn/belt.webp', isExcluded: false, type: 'belt', slug: 'belt-ingenuity', name: 'Ingenuity' },
          { iconURL: null, isExcluded: true, type: 'ring', slug: 'ring-x', name: 'Excluded' },
          { slug: 'no-name' },
        ],
      },
      index,
    );

    expect(itemPriority).toEqual([{ slug: 'belt-ingenuity', name: 'Ingenuity', iconUrl: 'https://cdn/belt.webp', slot: 'belt' }]);
  });

  it('returns nothing for missing equipment', () => {
    expect(parseEquipment(null, index)).toEqual({ slots: [], itemPriority: [] });
  });
});
