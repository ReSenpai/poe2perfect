import type { CommentsList, CommentsPage, CommentsSeed, CommentsSort } from './model';
import { mergeCommentLists, parseCommentsPayload } from './parse-comments';
import { isAbort, type CommentsError, type CommentsSource, type SourceResult } from './source';

/** A request's progress; after an error `retryAt` (epoch ms) is when the site said to ask again, if it did. */
export type LoadState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string; retryAt: number | null };

export interface RepliesState {
  load: LoadState;
  /** Continuation of this comment's replies; null until they were asked for. */
  page: CommentsPage | null;
}

export type CommentsState =
  | { status: 'disabled' }
  | { status: 'unavailable'; canRetry: boolean; total: number | null; load: LoadState }
  | {
      status: 'ready';
      sort: CommentsSort;
      canSort: boolean;
      total: number | null;
      list: CommentsList;
      /** Next page of roots. */
      more: LoadState;
      /** First page in another order; the list and `sort` change only once it has come. */
      resort: LoadState;
      /** Loading of replies, by parent id. */
      replies: Record<string, RepliesState>;
    };

type ReadyState = Extract<CommentsState, { status: 'ready' }>;

export interface CommentsController {
  getState(): CommentsState;
  subscribe(listener: (state: CommentsState) => void): () => void;
  loadMore(): void;
  loadReplies(parentId: string): void;
  setSort(sort: CommentsSort): void;
  /** Loads the first page through the API when the build page didn't carry it. */
  retry(): void;
  /** Cancels everything; the reader left this build. */
  dispose(): void;
}

const IDLE: LoadState = { status: 'idle' };
const LOADING: LoadState = { status: 'loading' };
/** Replies read oldest first, as a conversation. */
const REPLY_ORDER: CommentsSort = 'OLD';
const UNREADABLE: CommentsError = { message: 'unexpected answer', retryAfterSeconds: null };

/** Whether `parentId` has replies that are not loaded yet. */
export function hasMissingReplies(state: ReadyState, parentId: string): boolean {
  const comment = state.list.comments[parentId];
  if (!comment) return false;
  const page = state.replies[parentId]?.page;
  if (page) return page.hasMore;
  return comment.replyCount > (state.list.replies[parentId]?.length ?? 0);
}

/**
 * One build's discussion: starts from the page's own first page, loads further roots, replies and other orders on
 * request. One request per kind at a time, none while the site asked to wait; pages of an abandoned order and
 * everything after `dispose` are dropped.
 */
export function createCommentsController({
  seed,
  source,
  now = Date.now,
}: {
  seed: CommentsSeed;
  source: CommentsSource;
  now?: () => number;
}): CommentsController {
  const resourceId = seed.status === 'disabled' ? null : seed.resourceId;
  const authorId = seed.status === 'disabled' ? null : seed.authorId;
  let state: CommentsState = initialState(seed);
  let generation = 0;
  let disposed = false;
  const pending = new Set<AbortController>();
  const listeners = new Set<(state: CommentsState) => void>();

  const set = (next: CommentsState) => {
    state = next;
    listeners.forEach((listener) => listener(state));
  };

  const ready = () => (state.status === 'ready' ? state : null);

  const canStart = (load: LoadState) => load.status === 'idle' || (load.status === 'error' && (load.retryAt === null || now() >= load.retryAt));

  const failed = (error: CommentsError): LoadState => ({
    status: 'error',
    message: error.message,
    retryAt: error.retryAfterSeconds === null ? null : now() + error.retryAfterSeconds * 1000,
  });

  /** Runs a request in the current generation; `apply` gets its list, or the reason it has none. */
  const run = (request: (signal: AbortSignal) => Promise<SourceResult>, apply: (outcome: { list: CommentsList } | { error: CommentsError }) => void) => {
    const runGeneration = generation;
    const abort = new AbortController();
    pending.add(abort);
    void request(abort.signal)
      .catch((error: unknown): SourceResult | null =>
        isAbort(error) ? null : { ok: false, error: { message: error instanceof Error ? error.message : String(error), retryAfterSeconds: null } },
      )
      .then((result) => {
        pending.delete(abort);
        if (!result || disposed || abort.signal.aborted || runGeneration !== generation) return;
        if (!result.ok) return apply({ error: result.error });
        const list = parseCommentsPayload(result.payload, authorId);
        apply(list ? { list } : { error: UNREADABLE });
      });
  };

  const cancelPending = () => {
    generation++;
    pending.forEach((abort) => abort.abort());
    pending.clear();
  };

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    loadMore() {
      const current = ready();
      if (disposed || !current || !current.list.page.hasMore || !canStart(current.more) || current.resort.status === 'loading') return;
      const cursor = current.list.page.cursor;
      set({ ...current, more: LOADING });
      run(
        (signal) => source.roots({ resourceId: resourceId!, sort: current.sort, cursor }, signal),
        (outcome) => {
          const latest = ready()!;
          set(
            'list' in outcome
              ? { ...latest, list: mergeCommentLists(latest.list, outcome.list, { rootsPage: true }), more: IDLE }
              : { ...latest, more: failed(outcome.error) },
          );
        },
      );
    },

    loadReplies(parentId) {
      const current = ready();
      if (disposed || !current || current.resort.status === 'loading') return;
      const thread = current.replies[parentId] ?? { load: IDLE, page: null };
      if (!canStart(thread.load) || (thread.page && !thread.page.hasMore)) return;
      const cursor = thread.page?.cursor ?? null;
      set({ ...current, replies: { ...current.replies, [parentId]: { ...thread, load: LOADING } } });
      run(
        (signal) => source.replies({ parentId, sort: REPLY_ORDER, cursor }, signal),
        (outcome) => {
          const latest = ready()!;
          const replies = (next: RepliesState) => ({ ...latest.replies, [parentId]: next });
          set(
            'list' in outcome
              ? {
                  ...latest,
                  list: mergeCommentLists(latest.list, outcome.list, { rootsPage: false }),
                  replies: replies({ load: IDLE, page: outcome.list.page }),
                }
              : { ...latest, replies: replies({ load: failed(outcome.error), page: thread.page }) },
          );
        },
      );
    },

    setSort(sort) {
      const current = ready();
      if (disposed || !current || !current.canSort) return;
      if (sort === current.sort && current.resort.status !== 'loading') return;
      cancelPending();
      // Whatever was loading in the old order was just cancelled.
      const replies = Object.fromEntries(
        Object.entries(current.replies).map(([id, thread]) => [id, thread.load.status === 'loading' ? { ...thread, load: IDLE } : thread]),
      );
      const more = current.more.status === 'loading' ? IDLE : current.more;
      if (sort === current.sort) {
        set({ ...current, more, replies, resort: IDLE });
        return;
      }
      set({ ...current, more, replies, resort: LOADING });
      run(
        (signal) => source.roots({ resourceId: resourceId!, sort, cursor: null }, signal),
        (outcome) => {
          const latest = ready()!;
          set(
            'list' in outcome
              ? { ...latest, sort, list: outcome.list, more: IDLE, resort: IDLE, replies: {} }
              : { ...latest, resort: failed(outcome.error) },
          );
        },
      );
    },

    retry() {
      if (disposed || state.status !== 'unavailable' || !state.canRetry || !canStart(state.load)) return;
      const { total } = state;
      set({ ...state, load: LOADING });
      run(
        (signal) => source.roots({ resourceId: resourceId!, sort: 'NEW', cursor: null }, signal),
        (outcome) =>
          set(
            'list' in outcome
              ? { status: 'ready', sort: 'NEW', canSort: true, total, list: outcome.list, more: IDLE, resort: IDLE, replies: {} }
              : { status: 'unavailable', canRetry: true, total, load: failed(outcome.error) },
          ),
      );
    },

    dispose() {
      disposed = true;
      cancelPending();
      listeners.clear();
    },
  };
}

function initialState(seed: CommentsSeed): CommentsState {
  switch (seed.status) {
    case 'disabled':
      return { status: 'disabled' };
    case 'unavailable':
      return { status: 'unavailable', canRetry: seed.resourceId !== null, total: seed.total, load: IDLE };
    case 'ready':
      return { status: 'ready', sort: seed.sort, canSort: seed.canSort, total: seed.total, list: seed.list, more: IDLE, resort: IDLE, replies: {} };
  }
}
