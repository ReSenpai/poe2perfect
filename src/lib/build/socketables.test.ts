import { describe, expect, it } from 'vitest';
import type { Socketable } from './model';
import { socketableEffectsOn } from './socketables';

const rune = (effects: string[], name = 'Iron Rune'): Socketable => ({ slug: 'soulcore-x', name, iconUrl: null, effects });

const IRON = rune([
  'Martial Weapon: 16% increased Physical Damage',
  'Wand or Staff: 25% increased Spell Damage',
  'Armour: 16% increased Armour, Evasion and Energy Shield',
]);

describe('socketableEffectsOn', () => {
  it('keeps the line for the kind of item the rune sits in, without its label', () => {
    expect(socketableEffectsOn(IRON, 'helmet')).toEqual(['16% increased Armour, Evasion and Energy Shield']);
    expect(socketableEffectsOn(IRON, 'wand')).toEqual(['25% increased Spell Damage']);
    expect(socketableEffectsOn(IRON, 'crossbow')).toEqual(['16% increased Physical Damage']);
  });

  it("counts shields, bucklers and foci as armour, the way the game's trade site groups them", () => {
    for (const itemClass of ['shield', 'buckler', 'focus', 'body-armour', 'gloves', 'boots']) {
      expect(socketableEffectsOn(IRON, itemClass)).toEqual(['16% increased Armour, Evasion and Energy Shield']);
    }
  });

  it('takes a line for one slot over nothing, and a sceptre is neither a wand nor a martial weapon', () => {
    const core = rune(['Wand or Staff: Minions deal 40% increased Damage', 'Sceptre: Allies in your Presence deal 10% increased Damage', 'Helmet: Raven-Touched']);

    expect(socketableEffectsOn(core, 'sceptre')).toEqual(['Allies in your Presence deal 10% increased Damage']);
    expect(socketableEffectsOn(core, 'staff')).toEqual(['Minions deal 40% increased Damage']);
    expect(socketableEffectsOn(core, 'helmet')).toEqual(['Raven-Touched']);
    expect(socketableEffectsOn(core, 'boots')).toEqual([]);
  });

  it('reads labels naming several kinds of item', () => {
    const idol = rune([
      'Martial Weapon Wand or Staff: 25% reduced Spirit',
      'Crossbow Bow or Spear: 10% increased Projectile Speed',
      'Maces or Talisman: 15% increased Stun Buildup',
      'Shield or Buckler: +5% to maximum Block chance',
    ]);

    expect(socketableEffectsOn(idol, 'wand')).toEqual(['25% reduced Spirit']);
    expect(socketableEffectsOn(idol, 'bow')).toEqual(['25% reduced Spirit', '10% increased Projectile Speed']);
    expect(socketableEffectsOn(idol, 'two-hand-mace')).toEqual(['25% reduced Spirit', '15% increased Stun Buildup']);
    expect(socketableEffectsOn(idol, 'buckler')).toEqual(['+5% to maximum Block chance']);
  });

  it('joins an unlabelled line to the labelled line after it: the site labels only the last line of a two-line bonus', () => {
    const idol = rune(['Targets can be affected by +1 of your Poisons', 'Martial Weapon: 25% reduced Poison Duration', 'Sceptre: Allies deal 13 to 20 Chaos Damage']);

    expect(socketableEffectsOn(idol, 'spear')).toEqual(['Targets can be affected by +1 of your Poisons\n25% reduced Poison Duration']);
    expect(socketableEffectsOn(idol, 'sceptre')).toEqual(['Allies deal 13 to 20 Chaos Damage']);
  });

  it('applies a line for all items anywhere, and leaves out labels it does not know', () => {
    const core = rune(['All: +10 to all Attributes', 'Fishing Rod: 20% increased Fish Size', 'Leftover line without a label']);

    expect(socketableEffectsOn(core, 'gloves')).toEqual(['+10 to all Attributes']);
  });

  it('shows nothing for an item of unknown class', () => {
    expect(socketableEffectsOn(IRON, null)).toEqual([]);
  });
});
