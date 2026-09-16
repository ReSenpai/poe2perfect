import type { Build } from '@/lib/build/model';

export type TabId = 'overview' | 'skills' | 'gear' | 'passives' | 'atlas' | 'progression';

export interface Route {
  tab: TabId;
  variantId: string | null;
}

export const TABS: readonly { id: TabId; label: string; hasVariant: boolean }[] = [
  { id: 'overview', label: 'Overview', hasVariant: false },
  { id: 'skills', label: 'Skills', hasVariant: true },
  { id: 'gear', label: 'Gear', hasVariant: true },
  { id: 'passives', label: 'Passives', hasVariant: true },
  { id: 'atlas', label: 'Atlas Tree', hasVariant: true },
  { id: 'progression', label: 'Progression', hasVariant: true },
];

/** Tabs this build has content for: the atlas tree only appears when some variant has one. */
export function availableTabs(build: Build): (typeof TABS)[number][] {
  const hasAtlas = build.variants.some((variant) => variant.atlas !== null);
  return TABS.filter((tab) => tab.id !== 'atlas' || hasAtlas);
}

/** Readable, unique URL slugs for the build's variants, e.g. "ENDGAME (FULL LIFE)" → "endgame-full-life". */
export function variantSlugs(build: Build): { byId: Map<string, string>; bySlug: Map<string, string> } {
  const byId = new Map<string, string>();
  const bySlug = new Map<string, string>();
  build.variants.forEach((variant, i) => {
    const base =
      variant.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `variant-${i + 1}`;
    let slug = base;
    for (let n = 2; bySlug.has(slug); n++) slug = `${base}-${n}`;
    byId.set(variant.id, slug);
    bySlug.set(slug, variant.id);
  });
  return { byId, bySlug };
}

/**
 * Tab and variant live in the hash as "#gear_act-1". Only [a-z0-9_-] is used: the site builds a CSS selector
 * from the hash on load and crashes on anything else (e.g. "/").
 */
const SEPARATOR = '_';

/**
 * Route from a location hash like "#gear_act-1". A hash without a known tab opens `fallbackTab` (e.g. the tab used
 * last) when the build has it, otherwise the overview.
 */
export function parseRoute(hash: string, build: Build, fallbackTab: TabId = 'overview'): Route {
  let decoded = hash.replace(/^#/, '');
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the raw hash when it isn't valid percent-encoding.
  }
  const [tabPart, variantPart] = decoded.split(SEPARATOR);
  const tabs = availableTabs(build);
  const tab = tabs.find((t) => t.id === tabPart)?.id;
  if (!tab) return { tab: tabs.some((t) => t.id === fallbackTab) ? fallbackTab : 'overview', variantId: build.defaultVariantId };
  const variantId = variantPart ? variantSlugs(build).bySlug.get(variantPart) : undefined;
  return { tab, variantId: variantId ?? build.defaultVariantId };
}

export function formatRoute(route: Route, build: Build): string {
  const tab = TABS.find((t) => t.id === route.tab);
  const slug = route.variantId ? variantSlugs(build).byId.get(route.variantId) : undefined;
  return tab?.hasVariant && slug ? `#${route.tab}${SEPARATOR}${slug}` : `#${route.tab}`;
}
