import { storage } from 'wxt/utils/storage';
import type { RememberedVariant, TabId } from '@/lib/ui/route';
import type { PageMode } from './controller';

/** Whether the user last chose the extension UI or the original site. */
export const pageModeItem = storage.defineItem<PageMode>('local:pageMode', { fallback: 'extension' });

/** Whether the build header is collapsed to leave more room for the build itself. */
export const headerCollapsedItem = storage.defineItem<boolean>('local:headerCollapsed', { fallback: false });

/** Whether At a Glance on the Overview tab is collapsed, leaving the guide texts more room. */
export const glanceCollapsedItem = storage.defineItem<boolean>('local:glanceCollapsed', { fallback: false });

/** The tab used last; opened for a build whose address names no tab. */
export const lastTabItem = storage.defineItem<TabId>('local:lastTab', { fallback: 'overview' });

/** The variant each build was last read at, by build slug, so a build opens where its reader left off. */
export const lastVariantsItem = storage.defineItem<Record<string, RememberedVariant>>('local:lastVariants', { fallback: {} });

/** How many builds are remembered; the ones read longest ago are forgotten first. */
const REMEMBERED_BUILDS = 30;

export function rememberVariant(
  remembered: Record<string, RememberedVariant>,
  buildSlug: string,
  variant: RememberedVariant,
): Record<string, RememberedVariant> {
  const { [buildSlug]: _dropped, ...rest } = remembered;
  const entries = [...Object.entries(rest), [buildSlug, variant] as const];
  return Object.fromEntries(entries.slice(-REMEMBERED_BUILDS));
}
