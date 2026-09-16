import type { EquipmentSlot, Gem, Passive, Skill, Variant } from '@/lib/build/model';
import { slotLabel } from './slots';

export interface GearChange {
  label: string;
  previous: EquipmentSlot | null;
  /** Null when the slot is emptied. */
  current: EquipmentSlot | null;
}

export interface StageChanges {
  addedSkills: Skill[];
  removedSkills: Skill[];
  addedSupports: Gem[];
  removedSupports: Gem[];
  gear: GearChange[];
  points: { total: number; delta: number; ascendancyTotal: number; ascendancyDelta: number };
  addedKeyPassives: Passive[];
  removedKeyPassives: Passive[];
  addedAscendancy: Passive[];
}

/** What a stage (variant) changes compared to the one before it; the first stage has everything new. */
export function stageChanges(previous: Variant | null, current: Variant): StageChanges {
  const supports = (variant: Variant | null) => uniqueBy(variant?.skills.flatMap((skill) => skill.supports) ?? [], (gem) => gem.slug);
  const skills = (variant: Variant | null) => variant?.skills ?? [];
  const passiveKey = (passive: Passive) => passive.nodeSlug ?? passive.name;

  const { passives } = current;
  const before = previous?.passives;
  return {
    addedSkills: missingFrom(skills(current), skills(previous), (skill) => skill.gem.slug),
    removedSkills: missingFrom(skills(previous), skills(current), (skill) => skill.gem.slug),
    addedSupports: missingFrom(supports(current), supports(previous), (gem) => gem.slug),
    removedSupports: missingFrom(supports(previous), supports(current), (gem) => gem.slug),
    gear: gearChanges(previous?.equipment ?? [], current.equipment),
    points: {
      total: passives.nodeCount,
      delta: passives.nodeCount - (before?.nodeCount ?? 0),
      ascendancyTotal: passives.ascendancyNodeCount,
      ascendancyDelta: passives.ascendancyNodeCount - (before?.ascendancyNodeCount ?? 0),
    },
    addedKeyPassives: missingFrom(passives.keyPassives, before?.keyPassives ?? [], passiveKey),
    removedKeyPassives: missingFrom(before?.keyPassives ?? [], passives.keyPassives, passiveKey),
    addedAscendancy: missingFrom(passives.ascendancy, before?.ascendancy ?? [], passiveKey),
  };
}

function gearChanges(previous: EquipmentSlot[], current: EquipmentSlot[]): GearChange[] {
  const key = (entry: EquipmentSlot) => `${entry.slot}:${entry.weaponSet ?? ''}`;
  const before = new Map(previous.map((entry) => [key(entry), entry]));
  const now = new Map(current.map((entry) => [key(entry), entry]));
  const same = (a: EquipmentSlot, b: EquipmentSlot) => a.item.slug === b.item.slug && a.item.name === b.item.name;

  const changes: GearChange[] = [];
  for (const entry of current) {
    const old = before.get(key(entry)) ?? null;
    if (!old || !same(old, entry)) changes.push({ label: label(entry), previous: old, current: entry });
  }
  for (const old of previous) {
    if (!now.has(key(old))) changes.push({ label: label(old), previous: old, current: null });
  }
  return changes;
}

function label(entry: EquipmentSlot): string {
  return slotLabel(entry.slot, entry.weaponSet) ?? entry.slot;
}

function missingFrom<T>(items: T[], others: T[], key: (item: T) => string): T[] {
  const present = new Set(others.map(key));
  return uniqueBy(items, key).filter((item) => !present.has(key(item)));
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
