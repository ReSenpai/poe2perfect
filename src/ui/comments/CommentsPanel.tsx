import { ArrowUpRight, MessageSquare, Search, X } from 'lucide-preact';
import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { CommentsController, CommentsState, LoadState } from '@/lib/comments/controller';
import { filterThreads, type FilteredThreads } from '@/lib/comments/filter';
import type { CommentsSort } from '@/lib/comments/model';
import { commentElementId } from './CommentCard';
import { CommentComposer } from './CommentComposer';
import { CommentThread, isShown, OPEN_BELOW_DEPTH } from './CommentThread';
import { useCommentsState } from './use-comments';

type Ready = Extract<CommentsState, { status: 'ready' }>;

const SORT_LABELS: Record<CommentsSort, string> = { NEW: 'Newest', OLD: 'Oldest', TOP: 'Top' };
/** Name of the CSS highlight that marks search matches (styled with `::highlight()`). */
const SEARCH_HIGHLIGHT = 'poe2perfect-comment-search';

/** The build's discussion as a feed: one slim bar (filter, search, sort), then the threads, loading more on scroll. */
export function CommentsPanel({
  controller,
  now = Date.now,
  onOpenOriginal,
}: {
  controller: CommentsController | null;
  now?: () => number;
  /** Shows the discussion on the site itself, in place of the guide. */
  onOpenOriginal?: () => void;
}) {
  const state = useCommentsState(controller);
  // Threads the reader opened or folded against the default; the rest follow their depth.
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [authorOnly, setAuthorOnly] = useState(false);
  // The order asked for, shown while its first page loads.
  const [wantedSort, setWantedSort] = useState<CommentsSort | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const filtered = state.status === 'ready' ? filterThreads(state.list, { query, authorReplied: authorOnly }) : null;

  useSearchHighlight(root, query);

  const openByDefault = (id: string) => state.status === 'ready' && (state.list.comments[id]?.depth ?? 0) < OPEN_BELOW_DEPTH;
  // A search opens the way to its matches whatever the reader folded.
  const isOpen = (id: string) => Boolean(filtered?.reveal.has(id)) || (toggled.get(id) ?? openByDefault(id));
  const toggle = (id: string) => setToggled((current) => new Map(current).set(id, !isOpen(id)));

  const showComment = (id: string) => {
    const element = (root.current?.getRootNode() as Document | ShadowRoot | undefined)?.getElementById(commentElementId(id));
    element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    element?.focus({ preventScroll: true });
  };

  const sortShown = state.status === 'ready' && state.resort.status === 'loading' && wantedSort ? wantedSort : state.status === 'ready' ? state.sort : 'NEW';

  // Filter, search and sort scroll away with the comments; the tab already names the discussion and counts it.
  const bar = state.status === 'ready' && (
    <header class="comments__bar">
      {state.canIdentifyAuthor && (
        <div class="comments__chips" role="group" aria-label="Filter comments">
          <button type="button" class="chip" aria-pressed={!authorOnly} onClick={() => setAuthorOnly(false)}>
            All comments
          </button>
          <button type="button" class="chip" aria-pressed={authorOnly} onClick={() => setAuthorOnly(true)}>
            Author replied
          </button>
        </div>
      )}
        <div class="comments__tools">
          <label class="comments__search">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search comments"
              placeholder="Search"
              value={query}
              onInput={(event) => setQuery((event.target as HTMLInputElement).value)}
            />
            {query && (
              <button type="button" class="comments__clear" aria-label="Clear search" title="Clear search" onClick={() => setQuery('')}>
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </label>
          {state.canSort && controller && (
            <select
              class="comments__sort"
              aria-label="Sort comments"
              value={sortShown}
              onChange={(event) => {
                const sort = (event.target as HTMLSelectElement).value as CommentsSort;
                setWantedSort(sort);
                controller.setSort(sort);
              }}
            >
              {(Object.keys(SORT_LABELS) as CommentsSort[]).map((sort) => (
                <option key={sort} value={sort}>
                  {SORT_LABELS[sort]}
                </option>
              ))}
            </select>
          )}
          {onOpenOriginal && (
            <button type="button" class="icon-button" aria-label="Open on Mobalytics" title="Open on Mobalytics" onClick={onOpenOriginal}>
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      {state.resort.status === 'error' && (
        <p class="comments__error" role="alert">{`Couldn't sort the comments (${state.resort.message}).`}</p>
      )}
    </header>
  );

  return (
    <div class="comments" ref={root}>
      {state.status === 'ready' ? (
        controller &&
        filtered && (
          <ReadyList
            state={state}
            controller={controller}
            filtered={filtered}
            searching={query.trim() !== '' || authorOnly}
            now={now()}
            isOpen={isOpen}
            onToggle={toggle}
            onShowComment={showComment}
            replyingTo={replyingTo}
            onReply={setReplyingTo}
            onSignIn={onOpenOriginal}
            bar={bar}
          />
        )
      ) : (
        <div class="comments__list">
          <Placeholder state={state} onRetry={() => controller?.retry()} onOpenOriginal={onOpenOriginal} />
        </div>
      )}
    </div>
  );
}

function ReadyList({
  state,
  controller,
  filtered,
  searching,
  bar,
  ...thread
}: {
  state: Ready;
  controller: CommentsController;
  filtered: FilteredThreads;
  /** A search or filter is on: the list shows part of what is loaded and does not load more by itself. */
  searching: boolean;
  now: number;
  isOpen: (id: string) => boolean;
  onToggle: (id: string) => void;
  onShowComment: (id: string) => void;
  replyingTo: string | null;
  onReply: (id: string | null) => void;
  onSignIn?: () => void;
  /** Filter, search and sort, at the top of the scrolling list. */
  bar: preact.ComponentChildren;
}) {
  const { page } = state.list;
  const { more } = state;
  const rootIds = filtered.rootIds.filter((id) => isShown(state, id));
  const end = useRef<HTMLDivElement>(null);
  const loaded = Object.values(state.list.comments).filter((comment) => !comment.deleted).length;

  useWhenVisible(end, () => controller.loadMore());

  return (
    <div class="comments__list">
      {bar}
      <CommentComposer
        label="Add a comment"
        placeholder="Ask the author or share how the build went…"
        submitLabel="Post"
        onSubmit={(text) => controller.post(null, text)}
        onSignIn={thread.onSignIn}
        inline
      />
      {searching && page.hasMore && (
        <p class="comments__scope-note">
          {`Searching loaded comments only (${state.total !== null ? `${loaded} of ${state.total}` : `${loaded}`}).`}
          <button type="button" class="comment__link" disabled={more.status === 'loading'} onClick={() => controller.loadMore()}>
            {more.status === 'loading' ? 'Loading…' : 'Load more'}
          </button>
        </p>
      )}
      {rootIds.length === 0 &&
        (searching ? (
          <EmptyState title="No matches in loaded comments" text="Try other words, or clear the search." />
        ) : (
          !page.hasMore && <EmptyState title="No comments yet" text="Nobody has commented on this guide so far." />
        ))}
      {rootIds.map((id) => (
        <CommentThread key={id} rootId={id} state={state} controller={controller} {...thread} />
      ))}
      {page.hasMore && !searching && more.status === 'idle' && <div ref={end} class="comments__end" aria-hidden="true" />}
      {more.status === 'loading' && !searching && (
        <p class="comments__more-status" role="status">
          <span class="spinner spinner--small" aria-hidden="true" />
          Loading more comments…
        </p>
      )}
      {more.status === 'error' && (
        <p class="comments__error" role="alert">
          {`Couldn't load more comments (${more.message}).`}
          {waitNote(more, thread.now)}
          <button type="button" class="comment__link" onClick={() => controller.loadMore()}>
            Try again
          </button>
        </p>
      )}
    </div>
  );
}

function Placeholder({
  state,
  onRetry,
  onOpenOriginal,
}: {
  state: Exclude<CommentsState, Ready>;
  onRetry: () => void;
  onOpenOriginal?: () => void;
}) {
  if (state.status === 'disabled') return <EmptyState title="Comments are disabled for this build" />;
  if (state.load.status === 'loading') {
    return (
      <div role="status" class="comments__loading">
        <span class="spinner" aria-hidden="true" />
        Loading comments…
      </div>
    );
  }
  const text = state.load.status === 'error' ? `Couldn't load comments (${state.load.message}).` : "The build page didn't include its discussion.";
  return (
    <EmptyState title="Comments are unavailable here" text={text}>
      <div class="comments__empty-actions">
        {state.canRetry && (
          <button type="button" class="button" onClick={onRetry}>
            Try again
          </button>
        )}
        {onOpenOriginal && <OriginalButton onOpen={onOpenOriginal} />}
      </div>
    </EmptyState>
  );
}

function EmptyState({ title, text, children }: { title: string; text?: string; children?: preact.ComponentChildren }) {
  return (
    <div class="comments__empty">
      <MessageSquare size={20} aria-hidden="true" />
      <p class="comments__empty-title">{title}</p>
      {text && <p class="comments__empty-text">{text}</p>}
      {children}
    </div>
  );
}

/** Switches to the site's own page in this tab, so the arrow points up-right rather than out of the browser. */
function OriginalButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" class="button comments__original" onClick={onOpen}>
      Open on Mobalytics
      <ArrowUpRight size={16} aria-hidden="true" />
    </button>
  );
}

function waitNote(load: Extract<LoadState, { status: 'error' }>, now: number): string {
  if (load.retryAt === null || load.retryAt <= now) return '';
  return ` The site asked to wait ${Math.ceil((load.retryAt - now) / 1000)} s.`;
}

/**
 * Calls `onVisible` when the element comes near the visible part of its scrolling list. The element is rendered only
 * while more may load, so every new one is watched afresh and a short page that leaves it in view loads the next.
 */
function useWhenVisible(element: RefObject<HTMLElement>, onVisible: () => void) {
  const callback = useRef(onVisible);
  callback.current = onVisible;

  useEffect(() => {
    const target = element.current;
    if (!target || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && callback.current(), {
      root: target.closest('.comments__list'),
      rootMargin: '0px 0px 400px 0px',
    });
    observer.observe(target);
    return () => observer.disconnect();
  });
}

/** Marks the query in the shown comments with the CSS Custom Highlight API, leaving the rendered text untouched. */
function useSearchHighlight(root: RefObject<HTMLElement>, query: string) {
  useEffect(() => {
    const registry = (globalThis.CSS as { highlights?: Map<string, unknown> } | undefined)?.highlights;
    const HighlightClass = (globalThis as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
    const container = root.current;
    const needle = query.trim().toLowerCase();
    if (!registry || !HighlightClass || !container || !needle) {
      registry?.delete(SEARCH_HIGHLIGHT);
      return undefined;
    }

    const ranges: Range[] = [];
    const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      if (!node.parentElement?.closest('.comment__text, .comment__name')) continue;
      const text = node.data.toLowerCase();
      for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + needle.length)) {
        const range = container.ownerDocument.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + needle.length);
        ranges.push(range);
      }
    }
    registry.set(SEARCH_HIGHLIGHT, new HighlightClass(...ranges));
    return () => registry.delete(SEARCH_HIGHLIGHT);
  });
}
