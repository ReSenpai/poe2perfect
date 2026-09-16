import type { Build, EquipmentSlot, Variant } from '@/lib/build/model';

/**
 * The variant that best represents the finished build: the one with the most items and skills,
 * the later one on a tie (guides usually go from leveling to endgame).
 */
export function showcaseVariant(build: Build): Variant | null {
  let best: Variant | null = null;
  let bestScore = -1;
  for (const variant of build.variants) {
    const score = variant.equipment.length + variant.skills.length;
    if (score >= bestScore) {
      best = variant;
      bestScore = score;
    }
  }
  return best;
}

/** Unique items of a variant, each once, in the order they appear on the character sheet. */
export function keyUniques(variant: Variant): EquipmentSlot[] {
  const seen = new Set<string>();
  return variant.equipment.filter((slot) => {
    if (slot.item.rarity !== 'unique' || seen.has(slot.item.slug)) return false;
    seen.add(slot.item.slug);
    return true;
  });
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function formatUpdated(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : DATE_FORMAT.format(date);
}

const HOSTS: [RegExp, string][] = [
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)twitch\.tv$/, 'Twitch'],
];

/** Readable host of a video link, or null when it isn't a safe http(s) URL. */
export function videoHost(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  const hostname = parsed.hostname.replace(/^www\./, '');
  return HOSTS.find(([pattern]) => pattern.test(hostname))?.[1] ?? hostname;
}
