import { LogOut } from 'lucide-preact';
import { useEffect, useState } from 'preact/hooks';
import type { PageController, PageMode, PageState } from '@/lib/page/controller';
import type { TabId } from '@/lib/ui/route';
import { BuildView } from '@/ui/build/BuildView';

export interface AppProps {
  state: PageState;
  onModeChange: (mode: PageMode) => void;
  onRetry: () => void;
  headerCollapsed: boolean;
  onHeaderCollapsedChange: (collapsed: boolean) => void;
  lastTab?: TabId;
  onTabChange?: (tab: TabId) => void;
  glanceCollapsed?: boolean;
  onGlanceCollapsedChange?: (collapsed: boolean) => void;
}

export function App({
  state,
  onModeChange,
  onRetry,
  headerCollapsed,
  onHeaderCollapsedChange,
  lastTab,
  onTabChange,
  glanceCollapsed,
  onGlanceCollapsedChange,
}: AppProps) {
  if (!state.active) return null;

  if (state.mode === 'original') {
    return (
      <button type="button" class="launcher" onClick={() => onModeChange('extension')}>
        Open guide
      </button>
    );
  }

  if (state.status === 'ready') {
    return (
      <div class="overlay" role="dialog" aria-label="poe2perfect">
        <BuildView
          key={state.build.id}
          build={state.build}
          initialHash={window.location.hash}
          onRouteChange={replaceHash}
          onOriginal={() => onModeChange('original')}
          subscribeToHash={subscribeToHash}
          headerCollapsed={headerCollapsed}
          onHeaderCollapsedChange={onHeaderCollapsedChange}
          defaultTab={lastTab}
          onTabChange={onTabChange}
          glanceCollapsed={glanceCollapsed}
          onGlanceCollapsedChange={onGlanceCollapsedChange}
        />
      </div>
    );
  }

  return (
    <div class="overlay" role="dialog" aria-label="poe2perfect">
      <div class="overlay__bar">
        <span class="overlay__brand">poe2perfect</span>
        <button type="button" class="icon-button" aria-label="Show original page" title="Show original page" onClick={() => onModeChange('original')}>
          <LogOut size={16} aria-hidden="true" />
        </button>
      </div>
      <main class="overlay__body">
        {state.status === 'loading' ? (
          <p class="overlay__status" role="status">
            <span class="spinner" aria-hidden="true" />
            Loading build…
            {state.progress && <span class="overlay__progress">The site is slow to answer. Attempt {state.progress.attempt} of {state.progress.attempts}…</span>}
          </p>
        ) : (
          <div class="notice" role="alert">
            <p class="notice__title">Couldn't show this build</p>
            <p class="notice__text">{state.message}</p>
            <div class="notice__actions">
              <button type="button" class="button button--accent" onClick={onRetry}>
                Try again
              </button>
              <button type="button" class="button" onClick={() => onModeChange('original')}>
                Open original page
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/** Keeps the tab in the URL for reloads and sharing, without piling up history entries. */
function replaceHash(hash: string) {
  window.history.replaceState(window.history.state, '', hash);
}

function subscribeToHash(onHash: (hash: string) => void): () => void {
  const listener = () => onHash(window.location.hash);
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export interface ConnectedAppProps {
  controller: PageController;
  initialHeaderCollapsed: boolean;
  /** Persists the preference; the UI state itself lives here so it survives switching builds. */
  onHeaderCollapsedChange: (collapsed: boolean) => void;
  initialLastTab?: TabId;
  /** Persists the tab used last, opened for builds whose address names no tab. */
  onLastTabChange?: (tab: TabId) => void;
  initialGlanceCollapsed?: boolean;
  /** Persists whether At a Glance on the Overview tab is collapsed. */
  onGlanceCollapsedChange?: (collapsed: boolean) => void;
}

export function ConnectedApp({
  controller,
  initialHeaderCollapsed,
  onHeaderCollapsedChange,
  initialLastTab,
  onLastTabChange,
  initialGlanceCollapsed = false,
  onGlanceCollapsedChange,
}: ConnectedAppProps) {
  const [state, setState] = useState(controller.getState());
  const [headerCollapsed, setHeaderCollapsed] = useState(initialHeaderCollapsed);
  const [lastTab, setLastTab] = useState(initialLastTab);
  const [glanceCollapsed, setGlanceCollapsed] = useState(initialGlanceCollapsed);

  useEffect(() => {
    setState(controller.getState());
    return controller.subscribe(setState);
  }, [controller]);

  const changeHeaderCollapsed = (collapsed: boolean) => {
    setHeaderCollapsed(collapsed);
    onHeaderCollapsedChange(collapsed);
  };

  const changeGlanceCollapsed = (collapsed: boolean) => {
    setGlanceCollapsed(collapsed);
    onGlanceCollapsedChange?.(collapsed);
  };

  const changeTab = (tab: TabId) => {
    setLastTab(tab);
    onLastTabChange?.(tab);
  };

  return (
    <App
      state={state}
      onModeChange={controller.setMode}
      onRetry={controller.retry}
      headerCollapsed={headerCollapsed}
      onHeaderCollapsedChange={changeHeaderCollapsed}
      lastTab={lastTab}
      onTabChange={changeTab}
      glanceCollapsed={glanceCollapsed}
      onGlanceCollapsedChange={changeGlanceCollapsed}
    />
  );
}
