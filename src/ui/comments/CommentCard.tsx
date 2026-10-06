import type { ComponentChildren } from 'preact';
import { User } from 'lucide-preact';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Comment } from '@/lib/comments/model';
import { fullDate, relativeTime } from '@/lib/comments/time';
import { toRichBlocks } from '@/lib/rich-text/convert';
import { RichText } from '@/ui/rich-text/RichText';

export const commentElementId = (id: string) => `comment-${id}`;

/** One comment: who, when, what. Thread controls come in as children. */
export function CommentCard({
  comment,
  now,
  replyingTo,
  onShowParent,
  children,
}: {
  comment: Comment;
  now: number;
  /** Name of the comment this one answers, for answers below the first level of replies. */
  replyingTo?: string;
  onShowParent?: () => void;
  children?: ComponentChildren;
}) {
  const { author } = comment;
  const classes = ['comment', comment.depth === 0 ? 'comment--root' : 'comment--reply', author?.isBuildAuthor ? 'comment--by-author' : ''];
  return (
    <article class={classes.filter(Boolean).join(' ')} id={commentElementId(comment.id)} tabIndex={-1}>
      <Avatar comment={comment} />
      <div class="comment__main">
        {!comment.deleted && (
          <header class="comment__meta">
            <span class="comment__name">{author?.name ?? 'Unknown user'}</span>
            {author?.isBuildAuthor && <span class="comment__badge">Build author</span>}
            {comment.createdAt && (
              <time class="comment__time" dateTime={comment.createdAt} title={fullDate(comment.createdAt)}>
                {relativeTime(comment.createdAt, now)}
              </time>
            )}
          </header>
        )}
        {replyingTo && (
          <button type="button" class="comment__replying" onClick={onShowParent}>
            {`Replying to @${replyingTo}`}
          </button>
        )}
        {comment.deleted ? (
          <p class="comment__unavailable">
            {comment.deleted === 'moderator' ? 'This comment was removed by a moderator.' : 'This comment was deleted by its author.'}
          </p>
        ) : (
          <CommentBody comment={comment} />
        )}
        {children}
      </div>
    </article>
  );
}

function Avatar({ comment }: { comment: Comment }) {
  const { author } = comment;
  const size = comment.depth === 0 ? 'comment__avatar' : 'comment__avatar comment__avatar--small';
  if (author?.avatarUrl) return <img class={size} src={author.avatarUrl} alt="" loading="lazy" />;
  const initial = author?.name.trim().charAt(0).toUpperCase();
  return (
    <span class={`${size} comment__avatar--blank`} aria-hidden="true">
      {initial || <User size={16} />}
    </span>
  );
}

/** The text, behind a spoiler button when the author marked it so; long texts fold after a few lines. */
function CommentBody({ comment }: { comment: Comment }) {
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const hidden = comment.spoiler !== null && !revealed;
  // An empty or unreadable rich body falls back to the plain text the site sends alongside it.
  const rich = useMemo(() => comment.body !== null && toRichBlocks(comment.body).length > 0, [comment.body]);

  useLayoutEffect(() => {
    const element = body.current;
    if (!element || expanded) return;
    setOverflowing(element.scrollHeight > element.clientHeight + 1);
  }, [comment, hidden, expanded]);

  if (hidden) {
    return (
      <button type="button" class="comment__spoiler" onClick={() => setRevealed(true)}>
        {`Show spoiler: ${comment.spoiler}`}
      </button>
    );
  }

  return (
    <>
      <div ref={body} class={expanded ? 'comment__body' : 'comment__body comment__body--folded'}>
        {rich ? <RichText value={comment.body} class="comment__text" /> : <p class="comment__text comment__text--plain">{comment.plainText}</p>}
      </div>
      {(overflowing || expanded) && (
        <button type="button" class="comment__link" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </>
  );
}
