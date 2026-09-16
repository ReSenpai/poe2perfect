import type { RawBuildDocument, RawStaticData } from './types';

const GRAPH_CATEGORY = 'poe2PassiveSkillsGraph';

interface GraphNode {
  slug: string;
  passiveSlug?: string;
}

interface GraphGroup {
  nodes: GraphNode[];
}

interface GraphTree {
  groups: GraphGroup[];
}

/**
 * Cuts the site's static data (~17 MB) down to the entries a build refers to,
 * so it can be stored as a test fixture. Any string in the build document —
 * item and gem slugs, passive node ids, rich text entity chips — counts as a reference.
 */
export function pickStaticSubset(staticData: RawStaticData, doc: RawBuildDocument): RawStaticData {
  const referenced = new Set<string>();
  collectStrings(doc, referenced);

  const subset: RawStaticData = {};
  const graph = staticData[GRAPH_CATEGORY];
  if (graph !== undefined) {
    // The graph goes first: its nodes point at passive skills that must be kept too.
    subset[GRAPH_CATEGORY] = pickGraph(graph, referenced);
  }

  for (const [name, category] of Object.entries(staticData)) {
    if (name === GRAPH_CATEGORY) continue;
    subset[name] = hasDataArray(category)
      ? { ...category, data: category.data.filter((entry) => isReferenced(entry, referenced)) }
      : category;
  }
  return subset;
}

function pickGraph(graph: RawStaticData[string], referenced: Set<string>): RawStaticData[string] {
  if (!hasDataArray(graph)) return graph;
  const trees = (graph.data as GraphTree[]).map((tree) => ({
    ...tree,
    groups: tree.groups
      .map((group) => ({ ...group, nodes: group.nodes.filter((node) => referenced.has(node.slug)) }))
      .filter((group) => group.nodes.length > 0),
  }));
  for (const tree of trees) {
    for (const group of tree.groups) {
      for (const node of group.nodes) {
        if (node.passiveSlug) referenced.add(node.passiveSlug);
      }
    }
  }
  return { ...graph, data: trees };
}

function isReferenced(entry: unknown, referenced: Set<string>): boolean {
  if (typeof entry !== 'object' || entry === null) return false;
  const { slug, id } = entry as { slug?: unknown; id?: unknown };
  return (typeof slug === 'string' && referenced.has(slug)) || (typeof id === 'string' && referenced.has(id));
}

function hasDataArray(category: unknown): category is { data: unknown[]; [key: string]: unknown } {
  return typeof category === 'object' && category !== null && Array.isArray((category as { data?: unknown }).data);
}

function collectStrings(value: unknown, into: Set<string>) {
  if (typeof value === 'string') {
    into.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, into);
  } else if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) collectStrings(item, into);
  }
}
