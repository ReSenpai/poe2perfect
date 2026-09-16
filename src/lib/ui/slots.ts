import type { EquipmentSlot, SlotId } from '@/lib/build/model';

const LABELS: Record<SlotId, string> = {
  helmet: 'Helmet',
  body: 'Body Armour',
  gloves: 'Gloves',
  boots: 'Boots',
  mainHand: 'Weapon',
  offHand: 'Offhand',
  amulet: 'Amulet',
  leftRing: 'Ring 1',
  rightRing: 'Ring 2',
  extraRing: 'Ring 3',
  belt: 'Belt',
  // The game keeps life flasks in the first flask slot and mana flasks in the second.
  flask1: 'Life Flask',
  flask2: 'Mana Flask',
  charm1: 'Charm 1',
  charm2: 'Charm 2',
  charm3: 'Charm 3',
};

export interface SheetSlot {
  slot: SlotId;
  weaponSet: 1 | 2 | null;
  equipped: EquipmentSlot | null;
}

/** Display name of an equipment slot; unknown values (e.g. raw priority list types) are returned as they are. */
export function slotLabel(slot: string | null, weaponSet: 1 | 2 | null = null): string | null {
  if (slot === null) return null;
  const label = LABELS[slot as SlotId] ?? slot;
  return weaponSet === 2 ? `${label} · Set 2` : label;
}

type SlotPosition = [SlotId, 1 | 2 | null];

/** The left column of the sheet: the four armour pieces and the belt. */
const ARMOUR: SlotPosition[] = [
  ['helmet', null],
  ['body', null],
  ['gloves', null],
  ['boots', null],
  ['belt', null],
];

/** Everything but armour, in sheet order; an optional group appears only when something is equipped in it. */
const OTHER: { positions: SlotPosition[]; optional: boolean }[] = [
  { positions: [['mainHand', 1], ['offHand', 1]], optional: false },
  { positions: [['mainHand', 2], ['offHand', 2]], optional: true },
  { positions: [['amulet', null], ['leftRing', null], ['rightRing', null]], optional: false },
  { positions: [['extraRing', null]], optional: true },
  { positions: [['flask1', null], ['flask2', null]], optional: false },
  { positions: [['charm1', null], ['charm2', null], ['charm3', null]], optional: false },
];

/**
 * The character sheet: standard slots always (empty ones with `equipped: null`, so the layout stays stable across
 * variants); optional slots — second weapon set, third ring — only when used.
 */
export function sheetSlots(equipment: EquipmentSlot[]): { armour: SheetSlot[]; other: SheetSlot[] } {
  const find = ([slot, weaponSet]: SlotPosition): SheetSlot => ({
    slot,
    weaponSet,
    equipped: equipment.find((s) => s.slot === slot && s.weaponSet === weaponSet) ?? null,
  });
  return {
    armour: ARMOUR.map(find),
    other: OTHER.flatMap(({ positions, optional }) => {
      const slots = positions.map(find);
      return optional && slots.every((s) => !s.equipped) ? [] : slots;
    }),
  };
}
