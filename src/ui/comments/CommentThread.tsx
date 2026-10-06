import { Minus, Plus } from 'lucide-preact';
import { useEffect } from 'preact/hooks';
import { hasMissingReplies, type CommentsController, type CommentsState, type PostOutcome } from '@/lib/comments/controller';
import { CommentCard } from './CommentCard';
import { CommentComposer } from './CommentComposer';

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
  /** The comment whose reply box is open, if any; one at a time. */
  replyingTo: string | null;
  onReply: (id: string | null) => void;
  /** Where a signed-out visitor can sign in. */
  onSignIn?: () => void;
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
 * A comment with its answers nested under it, as on Reddit: a line runs down from the avatar along the answers, each
 * answer hooks onto it, and the line or the ±-circle on it folds the branch.
 */
export function CommentThread({ id, ...props }: ThreadProps & { id: string }) {
  const { state, now, isOpen, onToggle } = props;
  const comment = state.list.comments[id]!;
  const open = isOpen(id) && hasReplies(state, id);
  const authorReplied = comment.depth === 0 && descendants(state, id).some((child) => state.list.comments[child]?.author?.isBuildAuthor);

  return (
    <CommentCard comment={comment} now={now} open={open}>
      {open && <div class="thread__rail" aria-hidden="true" onClick={() => onToggle(id)} />}
      <Actions id={id} {...props}>
        {authorReplied && <span class="comment__author-replied">Author replied</span>}
      </Actions>
      {open && (
        <div class="thread__replies" id={repliesElementId(id)}>
          <Replies parentId={id} {...props} />
        </div>
      )}
    </CommentCard>
  );
}

/**
 * The loaded answers to `parentId`, then how loading them is going. Answers the page left out are asked for as soon as
 * they are shown; further pages wait for "Load more replies".
 */
function Replies({ parentId, ...props }: ThreadProps & { parentId: string }) {
  const { state, controller } = props;
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
      {ids.map((id) => (
        <CommentThread key={id} id={id} {...props} />
      ))}
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

/** A comment's controls: the fold on its line, Reply, and the reply box once opened. */
function Actions({ id, children, ...props }: ThreadProps & { id: string; children?: preact.ComponentChildren }) {
  const { state, controller, isOpen, onToggle, replyingTo, onReply, onSignIn } = props;
  const comment = state.list.comments[id]!;
  const canReply = !comment.deleted;

  const post = (text: string): Promise<PostOutcome> => controller.post(id, text);
  const done = () => {
    onReply(null);
    if (!isOpen(id)) onToggle(id);
  };

  return (
    <>
      <div class="comment__actions">
        {hasReplies(state, id) && <Fold id={id} {...props} />}
        {canReply && (
          <button type="button" class="comment__link comment__reply" aria-expanded={replyingTo === id} onClick={() => onReply(replyingTo === id ? null : id)}>
            Reply
          </button>
        )}
        {children}
      </div>
      {canReply && replyingTo === id && (
        <CommentComposer
          label={`Reply to ${comment.author?.name ?? 'this comment'}`}
          placeholder="Write a reply…"
          submitLabel="Send reply"
          onSubmit={post}
          onDone={done}
          onCancel={() => onReply(null)}
          onSignIn={onSignIn}
          autoFocus
        />
      )}
    </>
  );
}

/** The ±-circle on the thread line: minus folds the answers away, plus brings them back. */
function Fold({ id, state, isOpen, onToggle }: ThreadProps & { id: string }) {
  const comment = state.list.comments[id]!;
  const loaded = state.list.replies[id]?.length ?? 0;
  const open = isOpen(id);
  const Icon = open ? Minus : Plus;
  const label = open ? 'Hide replies' : repliesLabel(Math.max(comment.replyCount, loaded));

  return (
    <button
      type="button"
      class="thread__fold"
      aria-label={label}
      title={label}
      aria-expanded={open}
      aria-controls={open ? repliesElementId(id) : undefined}
      onClick={() => onToggle(id)}
    >
      <Icon size={10} strokeWidth={3} aria-hidden="true" />
    </button>
  );
}

/** Every loaded comment below `id`. */
function descendants(state: Ready, id: string): string[] {
  const direct = state.list.replies[id] ?? [];
  return direct.flatMap((child) => [child, ...descendants(state, child)]);
}
