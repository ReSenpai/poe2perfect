import { describe, expect, it } from 'vitest';
import type { EquipmentSlot, SlotId } from '@/lib/build/model';
import { sheetSlots, slotLabel } from './slots';

function slot(id: SlotId, weaponSet: 1 | 2 | null = null): EquipmentSlot {
  return { slot: id, weaponSet, item: { name: `${id}${weaponSet ?? ''}` } as EquipmentSlot['item'], socketables: [] };
}

describe('slotLabel', () => {
  it.each([
    ['helmet', 'Helmet'],
    ['body', 'Body Armour'],
    ['mainHand', 'Weapon'],
    ['offHand', 'Offhand'],
    ['leftRing', 'Ring 1'],
    ['rightRing', 'Ring 2'],
    ['extraRing', 'Ring 3'],
    ['flask1', 'Life Flask'],
    ['flask2', 'Mana Flask'],
    ['charm3', 'Charm 3'],
  ] as const)('names %s "%s"', (id, label) => {
    expect(slotLabel(id)).toBe(label);
  });

  it('marks the second weapon set', () => {
    expect(slotLabel('mainHand', 2)).toBe('Weapon · Set 2');
    expect(slotLabel('offHand', 1)).toBe('Offhand');
  });

  it('names priority entries by their raw slot type, falling back to the raw value', () => {
    expect(slotLabel('belt')).toBe('Belt');
    expect(slotLabel('mystery')).toBe('mystery');
    expect(slotLabel(null)).toBeNull();
  });
});

describe('sheetSlots', () => {
  const key = (s: { slot: string; weaponSet: number | null; equipped: EquipmentSlot | null }) =>
    `${s.slot}${s.weaponSet ?? ''}${s.equipped ? '' : ' (empty)'}`;

  it('always lists the standard slots, marking the empty ones', () => {
    const { armour, other } = sheetSlots([slot('boots'), slot('mainHand', 1), slot('leftRing')]);

    // The belt stands with the armour; charms are part of the sheet even when the author left them empty.
    expect(armour.map(key)).toEqual(['helmet (empty)', 'body (empty)', 'gloves (empty)', 'boots', 'belt (empty)']);
    expect(other.map(key)).toEqual([
      'mainHand1',
      'offHand1 (empty)',
      'amulet (empty)',
      'leftRing',
      'rightRing (empty)',
      'flask1 (empty)',
      'flask2 (empty)',
      'charm1 (empty)',
      'charm2 (empty)',
      'charm3 (empty)',
    ]);
  });

  it('adds optional slots only when something is equipped in them', () => {
    const { other } = sheetSlots([slot('mainHand', 1), slot('mainHand', 2), slot('extraRing'), slot('charm1'), slot('charm3')]);

    expect(other.map(key)).toEqual([
      'mainHand1',
      'offHand1 (empty)',
      'mainHand2',
      'offHand2 (empty)',
      'amulet (empty)',
      'leftRing (empty)',
      'rightRing (empty)',
      'extraRing',
      'flask1 (empty)',
      'flask2 (empty)',
      'charm1',
      'charm2 (empty)',
      'charm3',
    ]);
  });

  it('keeps the equipped slot data', () => {
    const helmet = slot('helmet');

    expect(sheetSlots([helmet]).armour[0]).toEqual({ slot: 'helmet', weaponSet: null, equipped: helmet });
  });
});
