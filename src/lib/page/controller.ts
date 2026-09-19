import { getBuildSlug } from '@/lib/build-url';
import type { Build } from '@/lib/build/model';
import type { LoadResult } from './build-loader';
import type { FetchProgress } from './fetch-html';

export type PageMode = 'extension' | 'original';

interface ActiveBase {
  active: true;
  mode: PageMode;
  url: string;
  slug: string;
}

export type PageState =
  | { active: false; mode: PageMode }
  | (ActiveBase & { status: 'loading'; progress?: FetchProgress })
  | (ActiveBase & { status: 'ready'; build: Build })
  | (ActiveBase & { status: 'error'; message: string });

export interface PageController {
  getState(): PageState;
  handleUrl(url: string): void;
  /** Loads the current build again after a failure. */
  retry(): void;
  setMode(mode: PageMode): void;
  subscribe(listener: (state: PageState) => void): () => void;
}

/**
 * Page state for the current URL: which build is shown, its loading status and whether the
 * extension UI or the original site is in front. Results of superseded loads are dropped.
 */
export function createPageController({
  load,
  initialMode,
  onModeChange,
}: {
  load: (url: string, onProgress: (progress: FetchProgress) => void) => Promise<LoadResult>;
  initialMode: PageMode;
  onModeChange?: (mode: PageMode) => void;
}): PageController {
  let state: PageState = { active: false, mode: initialMode };
  let loadId = 0;
  const listeners = new Set<(state: PageState) => void>();

  const set = (next: PageState) => {
    state = next;
    listeners.forEach((listener) => listener(state));
  };

  const start = (url: string, slug: string) => {
    const id = ++loadId;
    set({ active: true, mode: state.mode, url, slug, status: 'loading' });
    const report = (progress: FetchProgress) => {
      if (id !== loadId || !state.active || state.status !== 'loading') return;
      set({ ...state, progress });
    };
    void load(url, report)
      .catch((error: unknown): LoadResult => ({ ok: false, message: error instanceof Error ? error.message : String(error) }))
      .then((result) => {
        if (id !== loadId || !state.active) return;
        const base = { active: true as const, mode: state.mode, url: state.url, slug };
        set(result.ok ? { ...base, status: 'ready', build: result.build } : { ...base, status: 'error', message: result.message });
      });
  };

  return {
    getState: () => state,

    handleUrl(url) {
      const slug = getBuildSlug(url);
      if (!slug) {
        loadId++;
        if (state.active) set({ active: false, mode: state.mode });
        return;
      }
      if (state.active && state.slug === slug) {
        state = { ...state, url };
        return;
      }
      start(url, slug);
    },

    retry() {
      if (state.active && state.status === 'error') start(state.url, state.slug);
    },

    setMode(mode) {
      if (mode === state.mode) return;
      set({ ...state, mode });
      onModeChange?.(mode);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function isOverlayVisible(state: PageState): boolean {
  return state.active && state.mode === 'extension';
}
