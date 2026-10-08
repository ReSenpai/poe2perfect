import type { Socketable } from './model';

/** Item classes, by the site's slugs, that the game's trade site groups as armour or as martial weapons. */
const ARMOUR = ['helmet', 'body-armour', 'gloves', 'boots', 'shield', 'buckler', 'focus'];
const MARTIAL = [
  'one-hand-sword',
  'two-hand-sword',
  'one-hand-axe',
  'two-hand-axe',
  'one-hand-mace',
  'two-hand-mace',
  'dagger',
  'claw',
  'spear',
  'flail',
  'warstaff',
  'bow',
  'crossbow',
  'talisman',
];
const WAND_OR_STAFF = ['wand', 'staff'];
const MACES = ['one-hand-mace', 'two-hand-mace'];

/**
 * What each label in front of a rune's or soul core's line covers. The labels are a closed set, checked against
 * all 313 socketables in the site's game data; a line under any other label is left out rather than guessed.
 */
const LABELS: Record<string, string[] | 'all'> = {
  All: 'all',
  Armour: ARMOUR,
  Helmet: ['helmet'],
  'Body Armour': ['body-armour'],
  Gloves: ['gloves'],
  Boots: ['boots'],
  Shield: ['shield'],
  Buckler: ['buckler'],
  'Shield or Buckler': ['shield', 'buckler'],
  Focus: ['focus'],
  'Martial Weapon': MARTIAL,
  'Wand or Staff': WAND_OR_STAFF,
  'Caster Weapon': WAND_OR_STAFF,
  'Martial Weapon Wand or Staff': [...MARTIAL, ...WAND_OR_STAFF],
  'Martial Or Caster Weapon': [...MARTIAL, ...WAND_OR_STAFF],
  Wand: ['wand'],
  Staff: ['staff'],
  Sceptre: ['sceptre'],
  Bow: ['bow'],
  Crossbow: ['crossbow'],
  Spear: ['spear'],
  Talisman: ['talisman'],
  Quarterstaff: ['warstaff'],
  'One Hand Mace': ['one-hand-mace'],
  'Two Hand Mace': ['two-hand-mace'],
  'One Hand Mace or Quarterstaff': ['one-hand-mace', 'warstaff'],
  'Crossbow Bow or Spear': ['crossbow', 'bow', 'spear'],
  'Maces or Talisman': [...MACES, 'talisman'],
  'Quarterstaff or Spear': ['warstaff', 'spear'],
};

const LABELLED = /^([A-Z][A-Za-z ]*?):\s+(.*)$/s;

/**
 * What a rune or soul core does in an item of this class (the site's slug, e.g. `body-armour`): its lines for that
 * class, without their labels. The site labels only the last line of a two-line bonus, so an unlabelled line is
 * joined to the labelled line after it.
 */
export function socketableEffectsOn(socketable: Socketable, itemClass: string | null): string[] {
  if (!itemClass) return [];
  const effects: string[] = [];
  let pending: string[] = [];
  for (const line of socketable.effects) {
    const match = LABELLED.exec(line);
    const covers = match ? LABELS[match[1]!] : undefined;
    if (!match || covers === undefined) {
      // Not a label we know: either the first line of a two-line bonus, or a label left out on purpose.
      if (!match) pending.push(line);
      else pending = [];
      continue;
    }
    if (covers === 'all' || covers.includes(itemClass)) effects.push([...pending, match[2]!].join('\n'));
    pending = [];
  }
  return effects;
}
