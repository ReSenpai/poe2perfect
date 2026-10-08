import type { ComponentChildren } from 'preact';
import { User } from 'lucide-preact';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Comment } from '@/lib/comments/model';
import { portraitFor } from '@/lib/comments/portraits';
import { fullDate, relativeTime } from '@/lib/comments/time';
import { toRichBlocks } from '@/lib/rich-text/convert';
import { RichText } from '@/ui/rich-text/RichText';

export const commentElementId = (id: string) => `comment-${id}`;

/** One comment: who, when, what. Thread controls and nested answers come in as children. */
export function CommentCard({
  comment,
  now,
  open = false,
  children,
}: {
  comment: Comment;
  now: number;
  /** Its answers are shown below it, along the thread line. */
  open?: boolean;
  children?: ComponentChildren;
}) {
  const { author } = comment;
  const classes = [
    'comment',
    comment.depth === 0 ? 'comment--root' : 'comment--reply',
    author?.isBuildAuthor ? 'comment--by-author' : '',
    open ? 'comment--open' : '',
  ];
  return (
    <article class={classes.filter(Boolean).join(' ')} id={commentElementId(comment.id)} tabIndex={-1}>
      <Avatar comment={comment} />
      <div class="comment__main">
        <header class="comment__meta">
          {comment.deleted ? (
            // As the site heads it: no name or avatar survive the deletion.
            <span class="comment__name comment__name--deleted">[deleted]</span>
          ) : (
            <span class="comment__name">{author?.name ?? 'Unknown user'}</span>
          )}
          {author?.isBuildAuthor && <span class="comment__badge">Build author</span>}
          {comment.createdAt && (
            <time class="comment__time" dateTime={comment.createdAt} title={fullDate(comment.createdAt)}>
              {relativeTime(comment.createdAt, now)}
            </time>
          )}
        </header>
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

/**
 * The commenter's own avatar; without one, a class portrait that stays theirs (see `portraitFor`); when a picture
 * does not load, the next one, then the initial. A deleted comment keeps a plain silhouette.
 */
function Avatar({ comment }: { comment: Comment }) {
  const { author } = comment;
  const size = comment.depth === 0 ? 'comment__avatar' : 'comment__avatar comment__avatar--small';
  const pictures = author ? [author.avatarUrl, portraitFor(author.id || author.name)].filter((url): url is string => Boolean(url)) : [];
  const [failed, setFailed] = useState<readonly string[]>([]);
  const picture = pictures.find((url) => !failed.includes(url));
  if (picture) {
    return <img class={size} src={picture} alt="" loading="lazy" onError={() => setFailed((urls) => [...urls, picture])} />;
  }
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
