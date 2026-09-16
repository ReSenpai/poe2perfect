import { type Obj, obj, objs, str } from '@/lib/data/coerce';
import type { RawStaticData } from '@/lib/data/types';

export type StaticEntry = Obj;

export interface StaticIndex {
  available: boolean;
  gem(slug: string): StaticEntry | null;
  /** Slug of a gem by its name; weapon-granted versions (e.g. "weapongrantedchaosboltplayer") win. */
  gemSlugByName(name: string): string | null;
  item(slug: string): StaticEntry | null;
  socketable(slug: string): StaticEntry | null;
  affix(slug: string): StaticEntry | null;
  passive(slug: string): StaticEntry | null;
  passiveSlugOfNode(nodeSlug: string): string | null;
  passiveOfNode(nodeSlug: string): StaticEntry | null;
}

const ITEM_CATEGORIES = [
  'poe2Weapons',
  'poe2Armours',
  'poe2Shields',
  'poe2Focuses',
  'poe2Quivers',
  'poe2Amulets',
  'poe2Rings',
  'poe2Flasks',
  'poe2Jewels',
];

/** Slug lookups over the site's static data; every lookup is null-safe when data is missing. */
export function createStaticIndex(staticData: RawStaticData | null): StaticIndex {
  const bySlug = (...categories: string[]) => {
    const map = new Map<string, StaticEntry>();
    for (const category of categories) {
      for (const entry of objs(obj(staticData?.[category])?.data)) {
        const slug = str(entry.slug) ?? str(entry.id);
        if (slug && !map.has(slug)) map.set(slug, entry);
      }
    }
    return map;
  };

  const gems = bySlug('poe2Gems');
  const gemSlugs = new Map<string, string>();
  for (const [slug, entry] of gems) {
    const name = str(entry.name);
    if (name && (!gemSlugs.has(name) || slug.includes('granted'))) gemSlugs.set(name, slug);
  }
  const items = bySlug(...ITEM_CATEGORIES);
  const socketables = bySlug('poe2SoulCores');
  const affixes = bySlug('poe2Prefixes', 'poe2Suffixes');
  const passives = bySlug('poe2PassiveSkills');

  const nodeToPassive = new Map<string, string>();
  for (const tree of objs(obj(staticData?.poe2PassiveSkillsGraph)?.data)) {
    for (const group of objs(tree.groups)) {
      for (const node of objs(group.nodes)) {
        const nodeSlug = str(node.slug);
        const passiveSlug = str(node.passiveSlug);
        if (nodeSlug && passiveSlug) nodeToPassive.set(nodeSlug, passiveSlug);
      }
    }
  }

  const find = (map: Map<string, StaticEntry>) => (slug: string) => map.get(slug) ?? null;

  return {
    available: staticData !== null,
    gem: find(gems),
    gemSlugByName: (name) => gemSlugs.get(name) ?? null,
    item: find(items),
    socketable: find(socketables),
    affix: find(affixes),
    passive: find(passives),
    passiveSlugOfNode: (nodeSlug) => nodeToPassive.get(nodeSlug) ?? null,
    passiveOfNode: (nodeSlug) => {
      const passiveSlug = nodeToPassive.get(nodeSlug);
      return passiveSlug ? (passives.get(passiveSlug) ?? null) : null;
    },
  };
}
