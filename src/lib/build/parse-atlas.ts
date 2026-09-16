import { obj, strings } from '@/lib/data/coerce';
import type { AtlasGroup, AtlasTree } from './model';
import { passiveFromNode } from './parse-passives';
import type { StaticIndex } from './static-index';

const LABELS: Record<string, string> = {
  mainTree: 'Atlas',
  breachTree: 'Breach',
  expeditionTree: 'Expedition',
  deliriumTree: 'Delirium',
  ritualTree: 'Ritual',
  bossTree: 'Bosses',
  pinnacleBossTree: 'Pinnacle Bosses',
  abyssalTree: 'Abyss',
  incursionTree: 'Incursion',
};

const TREE_KEY = /^([a-z][a-zA-Z]*)Tree$/;

/** The atlas tree of a variant: `{ mainTree, expeditionTree, … }`, each with the node slugs taken. */
export function parseAtlas(raw: unknown, index: StaticIndex): AtlasTree | null {
  const trees = obj(raw);
  if (!trees) return null;

  let pointCount = 0;
  const groups: AtlasGroup[] = [];
  for (const [id, value] of Object.entries(trees)) {
    const name = TREE_KEY.exec(id)?.[1];
    if (!name) continue;
    const selected = strings(obj(value)?.selectedSlugs);
    pointCount += selected.length;
    const passives = selected.flatMap((nodeSlug) => {
      const passive = passiveFromNode(nodeSlug, index);
      return passive && (passive.kind === 'keystone' || passive.kind === 'notable') ? [passive] : [];
    });
    if (passives.length > 0) groups.push({ id, label: LABELS[id] ?? humanize(name), passives });
  }
  return pointCount > 0 ? { pointCount, groups } : null;
}

/** "strangeNew" → "Strange New". */
function humanize(name: string): string {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, (first) => first.toUpperCase());
}
