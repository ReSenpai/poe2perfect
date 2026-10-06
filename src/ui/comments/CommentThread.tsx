import { ChevronDown, ChevronUp } from 'lucide-preact';
import { useEffect } from 'preact/hooks';
import { hasMissingReplies, type CommentsController, type CommentsState } from '@/lib/comments/controller';
import { CommentCard } from './CommentCard';

type Ready = Extract<CommentsState, { status: 'ready' }>;

/** Comments above this depth show their answers from the start, so a thread reads down to its third level of answers. */
export const OPEN_BELOW_DEPTH = 3;

export interface ThreadProps {
  state: Ready;
  controller: CommentsController;
  now: number;
  /** Whether a comment's answers are shown: open by depth unless the reader toggled it. Shared by every thread. */
  isOpen: (id: string) => boolean;
  onToggle: (id: string) => void;
  /** Brings a comment into view, e.g. the one a reply answers. */
  onShowComment: (id: string) => void;
}

const repliesLabel = (n: number) => (n === 1 ? 'View 1 reply' : n > 1 ? `View ${n} replies` : 'View replies');
const repliesElementId = (id: string) => `comment-replies-${id}`;

const hasReplies = (state: Ready, id: string) => (state.list.comments[id]?.replyCount ?? 0) > 0 || (state.list.replies[id]?.length ?? 0) > 0;

/** Whether to show a comment: the site leaves out deleted ones nobody answered. */
export const isShown = (state: Ready, id: string) => {
  const comment = state.list.comments[id];
  return Boolean(comment) && (!comment!.deleted || hasReplies(state, id));
};

/**
 * A root comment with its replies. Every answer sits one step in, in reading order; an answer to a reply follows that
 * reply and says whom it answers, so the thread never turns into a staircase.
 */
export function CommentThread({ rootId, ...props }: ThreadProps & { rootId: string }) {
  const { state, now, isOpen } = props;
  const root = state.list.comments[rootId]!;
  const authorReplied = descendants(state, rootId).some((id) => state.list.comments[id]?.author?.isBuildAuthor);

  return (
    <CommentCard comment={root} now={now}>
      <div class="comment__actions">
        {hasReplies(state, rootId) && <RepliesToggle id={rootId} {...props} />}
        {authorReplied && <span class="comment__author-replied">Author replied</span>}
      </div>
      {isOpen(rootId) && hasReplies(state, rootId) && (
        <div class="thread__replies" id={repliesElementId(rootId)}>
          <Replies parentId={rootId} {...props} />
        </div>
      )}
    </CommentCard>
  );
}

/**
 * The loaded answers to `parentId`, each followed by its own open answers, then how loading them is going. Answers the
 * page left out are asked for as soon as they are shown; further pages wait for "Load more replies".
 */
function Replies({ parentId, ...props }: ThreadProps & { parentId: string }) {
  const { state, controller, now, isOpen, onShowComment } = props;
  const parent = state.list.comments[parentId]!;
  const ids = (state.list.replies[parentId] ?? []).filter((id) => isShown(state, id));
  const thread = state.replies[parentId];
  const load = thread?.load ?? { status: 'idle' };
  const queried = Boolean(thread?.page);
  const missing = hasMissingReplies(state, parentId);

  useEffect(() => {
    if (!queried && load.status === 'idle' && missing) controller.loadReplies(parentId);
  }, [controller, parentId, queried, load.status, missing]);

  return (
    <>
      {ids.map((id) => {
        const reply = state.list.comments[id]!;
        return [
          <CommentCard
            key={id}
            comment={reply}
            now={now}
            replyingTo={parent.depth > 0 ? (parent.author?.name ?? 'deleted comment') : undefined}
            onShowParent={() => onShowComment(parentId)}
          >
            {/* Answers open by default fold with their root; deeper ones get their own toggle. */}
            {hasReplies(state, id) && (reply.depth >= OPEN_BELOW_DEPTH || !isOpen(id)) && (
              <div class="comment__actions">
                <RepliesToggle id={id} {...props} />
              </div>
            )}
          </CommentCard>,
          isOpen(id) && hasReplies(state, id) && <Replies key={`${id}-replies`} parentId={id} {...props} />,
        ];
      })}
      {load.status === 'loading' && (
        <p class="thread__status" role="status">
          <span class="spinner spinner--small" aria-hidden="true" />
          Loading replies…
        </p>
      )}
      {load.status === 'error' && (
        <p class="thread__status thread__status--error" role="alert">
          {`Couldn't load replies (${load.message}).`}
          <button type="button" class="comment__link" onClick={() => controller.loadReplies(parentId)}>
            Try again
          </button>
        </p>
      )}
      {load.status === 'idle' && queried && missing && (
        <button type="button" class="comment__link thread__more" onClick={() => controller.loadReplies(parentId)}>
          Load more replies
        </button>
      )}
    </>
  );
}

function RepliesToggle({ id, state, isOpen, onToggle }: ThreadProps & { id: string }) {
  const comment = state.list.comments[id]!;
  const loaded = state.list.replies[id]?.length ?? 0;
  const open = isOpen(id);
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      class="comment__link"
      aria-expanded={open}
      aria-controls={comment.depth === 0 && open ? repliesElementId(id) : undefined}
      onClick={() => onToggle(id)}
    >
      <span>{open ? 'Hide replies' : repliesLabel(Math.max(comment.replyCount, loaded))}</span>
      <Chevron size={14} aria-hidden="true" />
    </button>
  );
}

/** Every loaded comment below `id`. */
function descendants(state: Ready, id: string): string[] {
  const direct = state.list.replies[id] ?? [];
  return direct.flatMap((child) => [child, ...descendants(state, child)]);
}
