import { ArrowUpRight, Layers, MessageSquare } from 'lucide-preact';
import { useRef, useState } from 'preact/hooks';
import type { CommentsController, CommentsState, LoadState } from '@/lib/comments/controller';
import { commentElementId } from './CommentCard';
import { CommentThread, isShown, OPEN_BELOW_DEPTH } from './CommentThread';
import { useCommentsState } from './use-comments';

type Ready = Extract<CommentsState, { status: 'ready' }>;

/** `reply` heads for the site's reply box, `open` just to its discussion. */
export type OriginalIntent = 'open' | 'reply';

/** The build's discussion as a tab: header, the threads in the site's order, and the way to more of them. */
export function CommentsPanel({
  controller,
  now = Date.now,
  onOpenOriginal,
}: {
  controller: CommentsController | null;
  now?: () => number;
  /** Shows the discussion on the site itself, in place of the guide. */
  onOpenOriginal?: (intent: OriginalIntent) => void;
}) {
  const state = useCommentsState(controller);
  // Threads the reader opened or folded against the default; the rest follow their depth.
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(new Map());
  const root = useRef<HTMLDivElement>(null);
  const total = state.status === 'disabled' ? null : state.total;

  const openByDefault = (id: string) => state.status === 'ready' && (state.list.comments[id]?.depth ?? 0) < OPEN_BELOW_DEPTH;
  const isOpen = (id: string) => toggled.get(id) ?? openByDefault(id);
  const toggle = (id: string) => setToggled((current) => new Map(current).set(id, !isOpen(id)));

  const showComment = (id: string) => {
    const element = (root.current?.getRootNode() as Document | ShadowRoot | undefined)?.getElementById(commentElementId(id));
    element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    element?.focus({ preventScroll: true });
  };

  return (
    <div class="comments" ref={root}>
      <header class="comments__header">
        <div class="comments__heading">
          <h2 class="comments__title">
            Comments
            {total !== null && <span class="comments__count">{total}</span>}
          </h2>
          <p class="comments__subtitle">Discussion from the original build page</p>
        </div>
        <span class="comments__scope">
          <Layers size={14} aria-hidden="true" />
          All build variants
        </span>
      </header>
      {state.status === 'ready' ? (
        controller && (
          <ReadyList
            state={state}
            controller={controller}
            now={now()}
            isOpen={isOpen}
            onToggle={toggle}
            onShowComment={showComment}
            onOpenOriginal={onOpenOriginal}
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
  onOpenOriginal,
  ...thread
}: {
  state: Ready;
  controller: CommentsController;
  now: number;
  isOpen: (id: string) => boolean;
  onToggle: (id: string) => void;
  onShowComment: (id: string) => void;
  onOpenOriginal?: (intent: OriginalIntent) => void;
}) {
  const { page } = state.list;
  const rootIds = state.list.rootIds.filter((id) => isShown(state, id));
  return (
    <>
      <div class="comments__list">
        {rootIds.length === 0 && !page.hasMore ? (
          <EmptyState title="No comments yet" text="Nobody has commented on this guide so far." />
        ) : (
          rootIds.map((id) => <CommentThread key={id} rootId={id} state={state} controller={controller} {...thread} />)
        )}
      </div>
      {(page.hasMore || state.more.status === 'error' || onOpenOriginal) && (
        <footer class="comments__footer">
          {state.more.status === 'error' && (
            <p class="comments__error" role="alert">
              {`Couldn't load more comments (${state.more.message}).`}
              {waitNote(state.more, thread.now)}
            </p>
          )}
          {page.hasMore && (
            <button type="button" class="button comments__more" disabled={state.more.status === 'loading'} onClick={() => controller.loadMore()}>
              {state.more.status === 'loading' ? 'Loading…' : 'Load more comments'}
            </button>
          )}
          {onOpenOriginal && <OriginalButton intent="reply" onOpen={onOpenOriginal} />}
        </footer>
      )}
    </>
  );
}

function Placeholder({
  state,
  onRetry,
  onOpenOriginal,
}: {
  state: Exclude<CommentsState, Ready>;
  onRetry: () => void;
  onOpenOriginal?: (intent: OriginalIntent) => void;
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
        {onOpenOriginal && <OriginalButton intent="open" onOpen={onOpenOriginal} />}
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
function OriginalButton({ intent, onOpen }: { intent: OriginalIntent; onOpen: (intent: OriginalIntent) => void }) {
  return (
    <button type="button" class="button button--accent comments__original" onClick={() => onOpen(intent)}>
      {intent === 'reply' ? 'Reply on Mobalytics' : 'Open on Mobalytics'}
      <ArrowUpRight size={16} aria-hidden="true" />
    </button>
  );
}

function waitNote(load: Extract<LoadState, { status: 'error' }>, now: number): string {
  if (load.retryAt === null || load.retryAt <= now) return '';
  return ` The site asked to wait ${Math.ceil((load.retryAt - now) / 1000)} s.`;
}
