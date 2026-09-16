import { storage } from 'wxt/utils/storage';
import type { TabId } from '@/lib/ui/route';
import type { PageMode } from './controller';

/** Whether the user last chose the extension UI or the original site. */
export const pageModeItem = storage.defineItem<PageMode>('local:pageMode', { fallback: 'extension' });

/** Whether the build header is collapsed to leave more room for the build itself. */
export const headerCollapsedItem = storage.defineItem<boolean>('local:headerCollapsed', { fallback: false });

/** Whether At a Glance on the Overview tab is collapsed, leaving the guide texts more room. */
export const glanceCollapsedItem = storage.defineItem<boolean>('local:glanceCollapsed', { fallback: false });

/** The tab used last; opened for a build whose address names no tab. */
export const lastTabItem = storage.defineItem<TabId>('local:lastTab', { fallback: 'overview' });
