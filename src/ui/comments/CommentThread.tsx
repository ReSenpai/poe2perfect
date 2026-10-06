import { ChevronDown, ChevronUp } from 'lucide-preact';
import { hasMissingReplies, type CommentsController, type CommentsState } from '@/lib/comments/controller';
import { CommentCard } from './CommentCard';

type Ready = Extract<CommentsState, { status: 'ready' }>;

export interface ThreadProps {
  state: Ready;
  controller: CommentsController;
  now: number;
  /** Comments whose replies are open; shared by every thread of the panel. */
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  /** Brings a comment into view, e.g. the one a reply answers. */
  onShowComment: (id: string) => void;
}

const repliesLabel = (n: number) => (n === 1 ? 'View 1 reply' : n > 1 ? `View ${n} replies` : 'View replies');
const repliesElementId = (id: string) => `comment-replies-${id}`;

/**
 * A root comment with its replies. Every answer sits one step in, in reading order; an answer to a reply follows that
 * reply and says whom it answers, so the thread never turns into a staircase.
 */
export function CommentThread({ rootId, ...props }: ThreadProps & { rootId: string }) {
  const { state, now, expanded } = props;
  const root = state.list.comments[rootId]!;
  const open = expanded.has(rootId);
  const authorReplied = descendants(state, rootId).some((id) => state.list.comments[id]?.author?.isBuildAuthor);

  return (
    <CommentCard comment={root} now={now}>
      <div class="comment__actions">
        {hasReplies(state, rootId) && <RepliesToggle id={rootId} {...props} />}
        {authorReplied && <span class="comment__author-replied">Author replied</span>}
      </div>
      {open && (
        <div class="thread__replies" id={repliesElementId(rootId)}>
          <Replies parentId={rootId} {...props} />
        </div>
      )}
    </CommentCard>
  );
}

/** The loaded answers to `parentId`, each followed by its own open answers, then how loading them is going. */
function Replies({ parentId, ...props }: ThreadProps & { parentId: string }) {
  const { state, controller, now, expanded, onShowComment } = props;
  const parent = state.list.comments[parentId]!;
  const ids = state.list.replies[parentId] ?? [];
  const load = state.replies[parentId]?.load ?? { status: 'idle' };
  const queried = Boolean(state.replies[parentId]?.page);

  return (
    <>
      {ids.map((id) => {
        const reply = state.list.comments[id]!;
        const answersReply = parent.depth > 0;
        return [
          <CommentCard
            key={id}
            comment={reply}
            now={now}
            replyingTo={answersReply ? (parent.author?.name ?? 'deleted comment') : undefined}
            onShowParent={() => onShowComment(parentId)}
          >
            {hasReplies(state, id) && (
              <div class="comment__actions">
                <RepliesToggle id={id} {...props} />
              </div>
            )}
          </CommentCard>,
          expanded.has(id) && <Replies key={`${id}-replies`} parentId={id} {...props} />,
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
      {load.status === 'idle' && queried && hasMissingReplies(state, parentId) && (
        <button type="button" class="comment__link thread__more" onClick={() => controller.loadReplies(parentId)}>
          Load more replies
        </button>
      )}
    </>
  );
}

function RepliesToggle({ id, state, controller, expanded, onToggle }: ThreadProps & { id: string }) {
  const comment = state.list.comments[id]!;
  const loaded = state.list.replies[id]?.length ?? 0;
  const open = expanded.has(id);
  const Chevron = open ? ChevronUp : ChevronDown;

  const toggle = () => {
    // The first opening fetches what the page didn't include; later pages wait for "Load more replies".
    if (!open && !state.replies[id]?.page && hasMissingReplies(state, id)) controller.loadReplies(id);
    onToggle(id);
  };

  return (
    <button type="button" class="comment__link" aria-expanded={open} aria-controls={comment.depth === 0 ? repliesElementId(id) : undefined} onClick={toggle}>
      <span>{open ? 'Hide replies' : repliesLabel(Math.max(comment.replyCount, loaded))}</span>
      <Chevron size={14} aria-hidden="true" />
    </button>
  );
}

const hasReplies = (state: Ready, id: string) => (state.list.comments[id]?.replyCount ?? 0) > 0 || (state.list.replies[id]?.length ?? 0) > 0;

/** Every loaded comment below `id`. */
function descendants(state: Ready, id: string): string[] {
  const direct = state.list.replies[id] ?? [];
  return direct.flatMap((child) => [child, ...descendants(state, child)]);
}
