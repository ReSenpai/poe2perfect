import { ChevronsDown, ChevronsUp, LogOut, TriangleAlert } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Build } from '@/lib/build/model';
import { availableTabs, formatRoute, parseRoute, type RememberedVariant, type Route, type TabId } from '@/lib/ui/route';
import { TooltipProvider } from '@/ui/tooltip/Tooltip';
import { BuildHeader } from './BuildHeader';
import { GearPanel } from '@/ui/gear/GearPanel';
import { AtlasPanel } from '@/ui/passives/AtlasPanel';
import { PassivesPanel } from '@/ui/passives/PassivesPanel';
import { ProgressionPanel } from '@/ui/progression/ProgressionPanel';
import { SkillsPanel } from '@/ui/skills/SkillsPanel';
import { OverviewPanel } from './OverviewPanel';
import { VariantPicker } from './VariantPicker';
import { panelElementId, tabElementId, Tabs } from './Tabs';

/** Tabs whose content fills the panel instead of scrolling it (the embedded site trees, the stage view). */
const FILL_TABS: TabId[] = ['passives', 'atlas', 'progression'];

export interface BuildViewProps {
  build: Build;
  initialHash: string;
  onRouteChange: (hash: string) => void;
  onOriginal: () => void;
  /** Hash changes made outside the UI (typing in the address bar, back/forward). Returns an unsubscribe. */
  subscribeToHash?: (onHash: (hash: string) => void) => () => void;
  headerCollapsed: boolean;
  onHeaderCollapsedChange: (collapsed: boolean) => void;
  /** Tab to open when the hash names none, e.g. the one used last. */
  defaultTab?: TabId;
  /** The user picked another tab (not called for variant changes). */
  onTabChange?: (tab: TabId) => void;
  /** Variant to open when the address names none, e.g. the one this build was last read at. */
  defaultVariant?: RememberedVariant | null;
  /** The user picked another variant. */
  onVariantChange?: (variant: RememberedVariant) => void;
  glanceCollapsed?: boolean;
  onGlanceCollapsedChange?: (collapsed: boolean) => void;
}

const NO_VARIANTS = "The author hasn't added build variants yet.";
const DATA_WARNING = 'Game data could not be loaded: some names, icons and tooltips are missing. Reload the page to try again.';

export function BuildView({
  build,
  initialHash,
  onRouteChange,
  onOriginal,
  subscribeToHash,
  headerCollapsed,
  onHeaderCollapsedChange,
  defaultTab,
  onTabChange,
  defaultVariant,
  onVariantChange,
  glanceCollapsed,
  onGlanceCollapsedChange,
}: BuildViewProps) {
  const tabs = availableTabs(build);
  const [route, setRoute] = useState<Route>(() => parseRoute(initialHash, build, defaultTab, defaultVariant));

  useEffect(() => subscribeToHash?.((hash) => setRoute(parseRoute(hash, build))), [subscribeToHash, build]);

  const navigate = (next: Route) => {
    if (next.tab !== route.tab) onTabChange?.(next.tab);
    if (next.variantId !== route.variantId) {
      const picked = build.variants.find((v) => v.id === next.variantId);
      if (picked) onVariantChange?.({ id: picked.id, title: picked.title });
    }
    setRoute(next);
    onRouteChange(formatRoute(next, build));
  };
  const selectTab = (tab: TabId) => navigate({ ...route, tab });
  const selectVariant = (variantId: string) => navigate({ ...route, variantId });

  useNumberHotkeys((index) => {
    const tab = tabs[index];
    if (tab) selectTab(tab.id);
  });

  const tab = tabs.find((t) => t.id === route.tab)!;
  const variant = build.variants.find((v) => v.id === route.variantId) ?? build.variants[0];
  return (
    <TooltipProvider>
      <div class="build-view">
        {!headerCollapsed && <BuildHeader build={build} />}
        <div class="tab-bar">
          <Tabs tabs={tabs} selected={route.tab} onSelect={selectTab} />
          <div class="tab-bar__side">
            {!build.hasStaticData && (
              <span class="data-warning" title={DATA_WARNING}>
                <TriangleAlert size={16} role="img" aria-label="Game data unavailable" />
              </span>
            )}
            {headerCollapsed && (
              <span class="tab-bar__title" title={build.title}>
                {build.title}
              </span>
            )}
            <button
              type="button"
              class="icon-button"
              aria-label={headerCollapsed ? 'Expand header' : 'Collapse header'}
              title={headerCollapsed ? 'Expand header' : 'Collapse header'}
              aria-expanded={!headerCollapsed}
              onClick={() => onHeaderCollapsedChange(!headerCollapsed)}
            >
              {headerCollapsed ? <ChevronsDown size={16} aria-hidden="true" /> : <ChevronsUp size={16} aria-hidden="true" />}
            </button>
            <button type="button" class="icon-button" aria-label="Show original page" title="Show original page" onClick={onOriginal}>
              <LogOut size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <section
          class={FILL_TABS.includes(route.tab) ? 'build-view__panel build-view__panel--fill' : 'build-view__panel'}
          role="tabpanel"
          id={panelElementId(route.tab)}
          aria-labelledby={tabElementId(route.tab)}
        >
          {tab.hasVariant && route.tab !== 'progression' && <VariantPicker variants={build.variants} selectedId={variant?.id ?? null} onChange={selectVariant} />}
          {route.tab === 'overview' && (
            <OverviewPanel build={build} glanceCollapsed={glanceCollapsed} onGlanceCollapsedChange={onGlanceCollapsedChange} />
          )}
          {tab.hasVariant && !variant && <p class="panel-empty">{NO_VARIANTS}</p>}
          {route.tab === 'gear' && variant && <GearPanel variant={variant} entities={build.entities} />}
          {route.tab === 'skills' && variant && <SkillsPanel key={variant.id} variant={variant} entities={build.entities} />}
          {route.tab === 'passives' && variant && <PassivesPanel variant={variant} variantIndex={build.variants.indexOf(variant)} entities={build.entities} />}
          {route.tab === 'atlas' && variant && <AtlasPanel variant={variant} variantIndex={build.variants.indexOf(variant)} entities={build.entities} />}
          {route.tab === 'progression' && variant && (
            <ProgressionPanel build={build} variant={variant} onSelectVariant={selectVariant} onOpenTab={selectTab} />
          )}
        </section>
      </div>
    </TooltipProvider>
  );
}

/**
 * Keys 1–9 without modifiers, outside text fields. Listens in the capture phase: the UI's shadow root
 * stops key events from bubbling to the page.
 */
function useNumberHotkeys(onNumber: (index: number) => void) {
  const handler = useRef(onNumber);
  handler.current = onNumber;

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (!/^[1-9]$/.test(event.key) || isEditable(event.composedPath()[0])) return;
      handler.current(Number(event.key) - 1);
    };
    document.addEventListener('keydown', listener, true);
    return () => document.removeEventListener('keydown', listener, true);
  }, []);
}

function isEditable(target: EventTarget | undefined): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
