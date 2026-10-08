const GAME_IMAGES = 'https://cdn.mobalytics.gg/assets/poe-2/images/game';

/** Playable classes; the site keeps a 200 px portrait of each at `classes/icon/<class>.jpg`. */
const CLASSES = ['witch', 'ranger', 'warrior', 'sorceress', 'huntress', 'mercenary', 'monk', 'druid'];

/** Ascendancies, by the names of their portraits at `ascendancies/icon/poe-2-<name>.jpg`. */
const ASCENDANCIES = [
  'amazon',
  'ritualist',
  'tactician',
  'witchhunter',
  'gemling-legionnaire',
  'invoker',
  'acolyte-of-chayula',
  'deadeye',
  'pathfinder',
  'stormweaver',
  'chronomancer',
  'titan',
  'warbringer',
  'smith-of-kitava',
  'infernalist',
  'blood-mage',
  'lich',
  'oracle',
  'shaman',
  'disciple-of-varashta',
  'spirit-walker',
  'martial-artist',
];

/**
 * The site's own portraits of every class and ascendancy, linked from its CDN as item icons are, never copied here.
 * Commenters without an avatar get one of them. The order only ever grows at the end, so a reader keeps theirs.
 */
export const PORTRAITS: readonly string[] = [
  ...CLASSES.map((name) => `${GAME_IMAGES}/classes/icon/${name}.jpg`),
  ...ASCENDANCIES.map((name) => `${GAME_IMAGES}/ascendancies/icon/poe-2-${name}.jpg`),
];

/** A portrait for an account: picked by a hash of its id, so it looks random but never changes for that account. */
export function portraitFor(key: string): string {
  return PORTRAITS[fnv1a(key) % PORTRAITS.length]!;
}

/** 32-bit FNV-1a: small, stable across runs and browsers, and spreads short ids well. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}
