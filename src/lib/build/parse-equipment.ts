import { type Obj, num, obj, objs, str, strings } from '@/lib/data/coerce';
import type { EquipmentSlot, GrantedSkill, Item, ItemRef, NameValue, Rarity, SlotId, Socketable } from './model';
import { gemFromStatic } from './parse-skills';
import type { StaticIndex } from './static-index';

const ARMOUR_SLOTS: SlotId[] = ['helmet', 'body', 'gloves', 'boots'];
const WEAPON_SLOTS: SlotId[] = ['mainHand', 'offHand'];
const GRANTS_SKILL = /^Grants Skill:\s*(?:Level\s+(\S+)\s+)?(.+)$/;

const OTHER_SLOTS: SlotId[] = ['amulet', 'leftRing', 'rightRing', 'extraRing', 'belt', 'flask1', 'flask2', 'charm1', 'charm2', 'charm3'];

export function parseEquipment(raw: unknown, index: StaticIndex): { slots: EquipmentSlot[]; itemPriority: ItemRef[] } {
  const equipment = obj(raw);
  if (!equipment) return { slots: [], itemPriority: [] };

  const slots: EquipmentSlot[] = [];
  const add = (slot: SlotId, weaponSet: 1 | 2 | null, rawSlot: unknown) => {
    const parsed = parseSlot(slot, weaponSet, rawSlot, index);
    if (parsed) slots.push(parsed);
  };

  for (const slot of ARMOUR_SLOTS) add(slot, null, equipment[slot]);
  for (const set of [1, 2] as const) {
    for (const slot of WEAPON_SLOTS) add(slot, set, obj(equipment[slot])?.[`set${set}`]);
  }
  for (const slot of OTHER_SLOTS) add(slot, null, equipment[slot]);

  return { slots, itemPriority: parseItemPriority(equipment.priorityList) };
}

function parseSlot(slot: SlotId, weaponSet: 1 | 2 | null, raw: unknown, index: StaticIndex): EquipmentSlot | null {
  const rawSlot = obj(raw);
  const item = parseItem(obj(rawSlot?.commonItem), index);
  if (!rawSlot || !item) return null;
  return { slot, weaponSet, item, socketables: objs(rawSlot.runes).flatMap((rune) => parseSocketable(rune, index)) };
}

function parseItem(raw: Obj | null, index: StaticIndex): Item | null {
  const slug = raw && str(raw.slug);
  const name = raw && str(raw.name);
  if (!raw || !slug || !name) return null;

  const isUnique = raw.isUnique === true;
  const staticItem = index.item(slug);
  const affixSlugs = [...objs(raw.prefixes), ...objs(raw.suffixes)].flatMap((affix) => str(affix.slug) ?? []);
  const rolled = objs(raw.explicitDescriptions).flatMap((line) => str(line.description) ?? []);

  let modifiers: string[];
  let modifiersSource: Item['modifiersSource'];
  if (rolled.length > 0) {
    [modifiers, modifiersSource] = [rolled, 'item'];
  } else if (affixSlugs.length > 0) {
    [modifiers, modifiersSource] = [affixSlugs.flatMap((affix) => strings(index.affix(affix)?.bakedDescriptions)), 'affixes'];
  } else if (isUnique && staticItem) {
    [modifiers, modifiersSource] = [strings(staticItem.bakedDescriptions), 'static'];
  } else {
    [modifiers, modifiersSource] = [[], 'none'];
  }
  // Granted skills come from the base type and, for uniques, from their modifiers too; keep them out of the modifiers.
  const grantedSkills = parseGrantedSkills([...strings(obj(staticItem?.baseItemType)?.bakedDescriptions), ...modifiers], index);
  modifiers = modifiers.filter((line) => !GRANTS_SKILL.test(line));
  if (modifiers.length === 0) modifiersSource = 'none';

  return {
    slug,
    name,
    iconUrl: str(raw.iconURL) ?? str(staticItem?.icon),
    rarity: rarityOf(isUnique, affixSlugs.length, modifiers.length),
    corrupted: strings(raw.modifiers).includes('Corrupted'),
    itemClass: str(raw.itemClassSlug),
    itemClassName: str(obj(obj(staticItem?.baseItemType)?.itemClass)?.name),
    modifiers,
    modifiersSource,
    grantedSkills,
    tradeUrl: tradeUrl(raw),
    properties: fallback(nameValues(raw.stats), () => staticStats(staticItem?.stats)),
    requirements: fallback(nameValues(raw.requirements), () => staticStats(obj(staticItem?.baseItemType)?.itemRequiredStats)),
    flavourText: str(staticItem?.flavourText),
  };
}

/** `poe2TradeRequest` holds the search the site sends to the official trade site. */
function tradeUrl(raw: Obj | null): string | null {
  const request = obj(raw?.poe2TradeRequest);
  const query = str(request?.query);
  if (!query) return null;
  const league = str(request?.currentLeague) ?? '';
  return `https://www.pathofexile.com/trade2/search/${encodeURIComponent(league)}?q=${encodeURIComponent(query)}`;
}

function parseGrantedSkills(lines: string[], index: StaticIndex): GrantedSkill[] {
  const skills = new Map<string, GrantedSkill>();
  for (const line of lines) {
    const match = GRANTS_SKILL.exec(line.trim());
    if (!match) continue;
    const name = match[2]!.trim();
    const level = match[1] ?? null;
    // The base and the unique may both name the skill; the one with a level says more.
    if (skills.has(name) && (level === null || skills.get(name)!.level !== null)) continue;
    const slug = index.gemSlugByName(name);
    skills.set(name, { name, level, gem: slug ? gemFromStatic(slug, index) : null });
  }
  return [...skills.values()];
}

function rarityOf(isUnique: boolean, affixCount: number, modifierCount: number): Rarity {
  if (isUnique) return 'unique';
  if (affixCount > 0) return affixCount <= 2 ? 'magic' : 'rare';
  return modifierCount > 0 ? 'rare' : 'normal';
}

/** An item known only by slug (e.g. mentioned in guide text), described from static data. */
export function staticItem(slug: string, index: StaticIndex): Item | null {
  const entry = index.item(slug);
  const name = str(entry?.name);
  return entry && name ? parseItem({ slug, name, isUnique: entry.isUnique === true }, index) : null;
}

export function socketableFromSlug(slug: string, index: StaticIndex): Socketable | null {
  return index.socketable(slug) ? (parseSocketable({ slug }, index)[0] ?? null) : null;
}

function parseSocketable(raw: Obj, index: StaticIndex): Socketable[] {
  const slug = str(raw.slug);
  if (!slug) return [];
  const entry = index.socketable(slug);
  return [
    {
      slug,
      name: str(entry?.name),
      iconUrl: str(entry?.icon) ?? str(raw.iconUrl),
      effects: strings(entry?.bakedDescriptions),
    },
  ];
}

function parseItemPriority(raw: unknown): ItemRef[] {
  return objs(raw).flatMap((entry) => {
    const slug = str(entry.slug);
    const name = str(entry.name);
    if (!slug || !name || entry.isExcluded === true) return [];
    return [{ slug, name, iconUrl: str(entry.iconURL), slot: str(entry.type) }];
  });
}

function fallback(values: NameValue[], alternative: () => NameValue[]): NameValue[] {
  return values.length > 0 ? values : alternative();
}

/** Static `{ value, stat: { name } }` entries, skipping zeroes (e.g. Armour 0 on an ES helmet). */
function staticStats(raw: unknown): NameValue[] {
  return objs(raw).flatMap((entry) => {
    const name = str(obj(entry.stat)?.name);
    const value = num(entry.value);
    return name && value ? [{ name, value: String(value) }] : [];
  });
}

function nameValues(raw: unknown): NameValue[] {
  return objs(raw).flatMap((entry) => {
    const name = str(entry.name);
    const value = str(entry.value);
    return name && value ? [{ name, value }] : [];
  });
}
