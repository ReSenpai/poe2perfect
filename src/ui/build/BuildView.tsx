import { ChevronsDown, ChevronsUp, LogOut, MessageSquare, TriangleAlert } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Build } from '@/lib/build/model';
import type { CommentsController } from '@/lib/comments/controller';
import { availableTabs, formatRoute, parseRoute, type RememberedVariant, type Route, TABS, type TabId } from '@/lib/ui/route';
import { TooltipProvider } from '@/ui/tooltip/Tooltip';
import { BuildHeader } from './BuildHeader';
import { GearPanel } from '@/ui/gear/GearPanel';
import { AtlasPanel } from '@/ui/passives/AtlasPanel';
import { PassivesPanel } from '@/ui/passives/PassivesPanel';
import { ProgressionPanel } from '@/ui/progression/ProgressionPanel';
import { SkillsPanel } from '@/ui/skills/SkillsPanel';
import { CommentsPanel } from '@/ui/comments/CommentsPanel';
import { useCommentsState } from '@/ui/comments/use-comments';
import { useCommentsUi } from '@/ui/comments/use-comments-ui';
import { OverviewPanel } from './OverviewPanel';
import { VariantPicker } from './VariantPicker';
import { panelElementId, tabElementId, Tabs } from './Tabs';

/** Tabs whose content fills the panel instead of scrolling it (the embedded site trees, the stage view). */
const FILL_TABS: TabId[] = ['passives', 'atlas', 'progression', 'comments'];
/** Tabs that scroll edge to edge and lay out their own margins, so the scrollbar sits at the window's right. */
const FLUSH_TABS: TabId[] = ['comments'];
/** Sections that make room for the comments panel beside them, each giving up its side column. */
const DOCK_TABS: TabId[] = ['overview', 'skills', 'gear', 'passives', 'atlas', 'progression'];
/** Narrower than this, the panel would squeeze the section: the discussion opens as a tab instead. */
const DOCK_MIN_WIDTH = '(min-width: 1180px)';

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
  /** The build's discussion; without one the Comments tab says it is unavailable. */
  comments?: CommentsController | null;
  /** Shows the discussion on the site itself, in place of the guide. */
  onOriginalComments?: () => void;
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
  comments = null,
  onOriginalComments,
}: BuildViewProps) {
  const tabs = availableTabs(build);
  const commentsState = useCommentsState(comments);
  const commentsTotal = commentsState.status === 'disabled' ? null : commentsState.total;
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
  // The comments panel beside a section, and the section the Comments tab was opened from, to go back to.
  const commentsUi = useCommentsUi();
  const wide = useMediaQuery(DOCK_MIN_WIDTH);
  const [panelOpen, setPanelOpen] = useState(false);
  const [backTo, setBackTo] = useState<{ tab: TabId; reopenPanel: boolean } | null>(null);
  const panelToggle = useRef<HTMLButtonElement>(null);
  const canDock = wide && DOCK_TABS.includes(route.tab);
  const docked = panelOpen && canDock;

  const selectTab = (tab: TabId) => {
    setBackTo(null);
    navigate({ ...route, tab });
  };
  /** Opens the Comments tab with a way back to the section it was opened from. */
  const openCommentsTab = (reopenPanel: boolean) => {
    setBackTo({ tab: route.tab, reopenPanel });
    navigate({ ...route, tab: 'comments' });
  };
  const goBack = () => {
    if (!backTo) return;
    setBackTo(null);
    setPanelOpen(backTo.reopenPanel);
    navigate({ ...route, tab: backTo.tab });
  };
  const closePanel = () => {
    setPanelOpen(false);
    panelToggle.current?.focus();
  };
  const expandPanel = () => {
    setPanelOpen(false);
    openCommentsTab(true);
  };

  // A window narrowed under the panel's needs moves the discussion into its tab rather than squeezing the section.
  useEffect(() => {
    if (!wide && panelOpen && DOCK_TABS.includes(route.tab)) expandPanel();
  }, [wide]);

  const selectVariant = (variantId: string) => navigate({ ...route, variantId });

  useNumberHotkeys((index) => {
    const tab = tabs[index];
    if (tab) selectTab(tab.id);
  });

  const backLabel = backTo && route.tab === 'comments' ? `Back to ${TABS.find((t) => t.id === backTo.tab)?.label ?? 'the guide'}` : null;

  const tab = tabs.find((t) => t.id === route.tab)!;
  const variant = build.variants.find((v) => v.id === route.variantId) ?? build.variants[0];
  return (
    <TooltipProvider>
      <div class="build-view">
        {!headerCollapsed && <BuildHeader build={build} />}
        <div class="tab-bar">
          <Tabs tabs={tabs} selected={route.tab} onSelect={selectTab} counts={commentsTotal === null ? {} : { comments: commentsTotal }} />
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
            {route.tab !== 'comments' &&
              (canDock ? (
                <button
                  ref={panelToggle}
                  type="button"
                  class={panelOpen ? 'icon-button icon-button--on' : 'icon-button'}
                  aria-label={panelOpen ? 'Close comments panel' : 'Open comments panel'}
                  title={panelOpen ? 'Close comments panel' : 'Open comments panel'}
                  aria-expanded={panelOpen}
                  onClick={() => setPanelOpen(!panelOpen)}
                >
                  <MessageSquare size={16} aria-hidden="true" />
                </button>
              ) : (
                <button type="button" class="icon-button" aria-label="Open comments" title="Open comments" onClick={() => openCommentsTab(false)}>
                  <MessageSquare size={16} aria-hidden="true" />
                </button>
              ))}
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
        <div class="build-view__body">
          <section
            class={['build-view__panel', FILL_TABS.includes(route.tab) && 'build-view__panel--fill', FLUSH_TABS.includes(route.tab) && 'build-view__panel--flush']
              .filter(Boolean)
              .join(' ')}
            role="tabpanel"
            id={panelElementId(route.tab)}
            aria-labelledby={tabElementId(route.tab)}
          >
            {tab.hasVariant && route.tab !== 'progression' && <VariantPicker variants={build.variants} selectedId={variant?.id ?? null} onChange={selectVariant} />}
            {route.tab === 'overview' && (
              <OverviewPanel build={build} glanceCollapsed={glanceCollapsed} onGlanceCollapsedChange={onGlanceCollapsedChange} besideComments={docked} />
            )}
            {tab.hasVariant && !variant && <p class="panel-empty">{NO_VARIANTS}</p>}
            {route.tab === 'gear' && variant && <GearPanel variant={variant} entities={build.entities} besideComments={docked} />}
            {route.tab === 'skills' && variant && <SkillsPanel key={variant.id} variant={variant} entities={build.entities} besideComments={docked} />}
            {route.tab === 'passives' && variant && <PassivesPanel variant={variant} variantIndex={build.variants.indexOf(variant)} entities={build.entities} besideComments={docked} />}
            {route.tab === 'atlas' && variant && <AtlasPanel variant={variant} variantIndex={build.variants.indexOf(variant)} entities={build.entities} besideComments={docked} />}
            {route.tab === 'progression' && variant && (
              <ProgressionPanel build={build} variant={variant} onSelectVariant={selectVariant} onOpenTab={selectTab} besideComments={docked} />
            )}
            {route.tab === 'comments' && (
              <CommentsPanel
                controller={comments}
                onOpenOriginal={onOriginalComments}
                ui={commentsUi}
                back={backLabel ? { label: backLabel, onBack: goBack } : undefined}
              />
            )}
          </section>
          {docked && (
            <aside
              class="build-view__aside"
              aria-label="Comments"
              onKeyDown={(event) => {
                // Nested controls (the sort menu, a reply box) handle their own Escape first.
                if (event.key === 'Escape' && !event.defaultPrevented) {
                  event.preventDefault();
                  closePanel();
                }
              }}
            >
              <CommentsPanel controller={comments} onOpenOriginal={onOriginalComments} ui={commentsUi} side={{ onClose: closePanel, onExpand: expandPanel }} />
            </aside>
          )}
        </div>
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

/** Whether the media query matches now, following changes; true where the browser cannot tell. */
function useMediaQuery(query: string): boolean {
  const read = () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : true);
  const [matches, setMatches] = useState(read);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}

function isEditable(target: EventTarget | undefined): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
