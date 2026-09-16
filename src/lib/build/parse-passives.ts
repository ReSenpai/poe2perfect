import { type Obj, num, obj, objs, str, strings } from '@/lib/data/coerce';
import type { Passive, PassiveKind, Passives } from './model';
import type { StaticEntry, StaticIndex } from './static-index';

const KIND_BY_PRIORITY_TYPE: Record<string, PassiveKind> = {
  KEY_STONE: 'keystone',
  NOTABLE: 'notable',
  ASCENDANCY_LARGE: 'ascendancy',
  CHOICE: 'ascendancy',
};

export function parsePassives(raw: unknown, index: StaticIndex): Passives {
  const tree = obj(raw);
  const main = obj(tree?.mainTree);
  const ascendancy = obj(tree?.ascendancyTree);
  const mainSelected = strings(main?.selectedSlugs);
  const ascendancySelected = strings(ascendancy?.selectedSlugs);

  return {
    nodeCount: mainSelected.length,
    ascendancyNodeCount: ascendancySelected.length,
    keyPassives: keyPassives(main, mainSelected, index, (p) => p.kind === 'keystone' || p.kind === 'notable'),
    ascendancy: keyPassives(ascendancy, ascendancySelected, index, (p) => p.kind === 'ascendancy' && isNotable(p, index)),
  };
}

/** The tree's priority list (selection order) when present, otherwise matching selected nodes. */
function keyPassives(tree: Obj | null, selected: string[], index: StaticIndex, isKey: (passive: Passive) => boolean): Passive[] {
  const priority = objs(tree?.priorityList);
  if (priority.length > 0) return priority.flatMap((entry) => fromPriority(entry, index) ?? []);
  return selected.flatMap((nodeSlug) => {
    const passive = passiveFromNode(nodeSlug, index);
    return passive && isKey(passive) ? [passive] : [];
  });
}

function fromPriority(entry: Obj, index: StaticIndex): Passive | null {
  const nodeSlug = str(entry.slug);
  if (!nodeSlug) return null;
  const resolved = passiveFromNode(nodeSlug, index);
  const name = resolved?.name ?? str(entry.name);
  if (!name) return null;
  return {
    nodeSlug,
    slug: resolved?.slug ?? str(entry.description),
    name,
    iconUrl: str(entry.iconURL) ?? resolved?.iconUrl ?? null,
    kind: resolved?.kind ?? KIND_BY_PRIORITY_TYPE[str(entry.type) ?? ''] ?? 'small',
    effects: resolved?.effects ?? [],
    flavourText: resolved?.flavourText ?? null,
  };
}

/** The passive on a tree node (passive or atlas tree). */
export function passiveFromNode(nodeSlug: string, index: StaticIndex): Passive | null {
  const slug = index.passiveSlugOfNode(nodeSlug);
  return slug ? fromSlug(slug, nodeSlug, index) : null;
}

/** A passive by its own slug, e.g. one mentioned in guide text. */
export function passiveFromSlug(slug: string, index: StaticIndex): Passive | null {
  return fromSlug(slug, null, index);
}

function fromSlug(slug: string, nodeSlug: string | null, index: StaticIndex): Passive | null {
  const entry = index.passive(slug);
  const name = str(entry?.name);
  if (!entry || !name) return null;
  return {
    nodeSlug,
    slug,
    name,
    iconUrl: str(entry.icon),
    kind: kindOf(entry),
    effects: strings(entry.bakedDescriptions),
    flavourText: str(entry.flavourText),
  };
}

function kindOf(entry: StaticEntry): PassiveKind {
  if (entry.keystone === true) return 'keystone';
  if ((num(entry.ascendancy) ?? -1) !== -1) return 'ascendancy';
  if (entry.notable === true) return 'notable';
  if (entry.jewelSocket === true) return 'jewel-socket';
  return 'small';
}

function isNotable(passive: Passive, index: StaticIndex): boolean {
  return passive.slug !== null && index.passive(passive.slug)?.notable === true;
}
