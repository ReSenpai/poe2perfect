import type { RawBuildDocument, RawWidget } from '@/lib/data/types';

/**
 * Synthetic comment data in the shape mobalytics.gg sends (checked on live pages, see docs/PLAN.md → «Комментарии»).
 * Real comments never go into the repository — `scrubBuildDocument` drops them from captured fixtures — so tests
 * build discussions from these helpers. Names and texts are made up.
 */

export const COMMENTS_TYPENAME = 'NgfDocumentCmWidgetCommentsV1';

/** Guide author's account id: `author.id` of the document, `accountId` of their comments. */
export const AUTHOR_ID = 'acc-author';

export type SortBy = 'NEW' | 'OLD' | 'TOP';

export interface RawComment {
  id: string;
  parentId: string | null;
  resourceId: string;
  depth: number;
  accountId: string;
  content: { root: unknown } | null;
  plainTextContent: string;
  status: 'PUBLISHED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedByModerator: boolean;
  deletedReason: string | null;
  publishedAt: string;
  isSpoiler: boolean;
  spoilerLabel: string;
  score: number;
  upvotes: number;
  downvotes: number;
  viewerVote: null;
  replyCount: number;
  profile: {
    user: { id: string; username: string; displayName: string };
    avatar: { id: string; name: string; iconUrl: string } | null;
    avatarFrame: null;
    title: null;
    commentator: { stats: { totalComments: number } };
  } | null;
}

export interface RawCommentsPayload {
  resourceId: string;
  commentId: string;
  error: { code: string; message: string; retryAfterSeconds: number | null } | null;
  page: { hasMoreItems: boolean; nextCursor: string | null };
  data: { parentId: string | null; sortBy: SortBy; limit: number; comments: RawComment[] };
}

export const resourceIdOf = (docId: string) => `Poe2:UG:${docId}`;

/** Lexical body the way the comment editor writes it: one paragraph per line. */
export function lexicalBody(...lines: string[]): { root: unknown } {
  return {
    root: {
      type: 'root',
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
      children: lines.map((line) => ({
        type: 'paragraph',
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: [{ type: 'text', text: line, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }],
      })),
    },
  };
}

let nextId = 0;

/** A published comment; `text` fills both the Lexical body and `plainTextContent`. */
export function rawComment(
  overrides: Partial<RawComment> & { text?: string; author?: { id: string; name: string; avatarUrl?: string } } = {},
): RawComment {
  const { text = 'Nice build, thanks.', author, ...rest } = overrides;
  const id = rest.id ?? `c${++nextId}`;
  const who = author ?? { id: `acc-${id}`, name: `User ${id}` };
  const at = rest.createdAt ?? '2026-09-20T10:00:00.000Z';
  return {
    id,
    parentId: null,
    resourceId: resourceIdOf('doc-1'),
    depth: rest.parentId ? 1 : 0,
    accountId: who.id,
    content: lexicalBody(...text.split('\n')),
    plainTextContent: text,
    status: 'PUBLISHED',
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    deletedByModerator: false,
    deletedReason: null,
    publishedAt: at,
    isSpoiler: false,
    spoilerLabel: '',
    score: 0,
    upvotes: 0,
    downvotes: 0,
    viewerVote: null,
    replyCount: 0,
    profile: {
      user: { id: who.id, username: who.name.toLowerCase().replace(/\s+/g, ''), displayName: who.name },
      avatar: who.avatarUrl ? { id: `av-${who.id}`, name: 'avatar', iconUrl: who.avatarUrl } : null,
      avatarFrame: null,
      title: null,
      commentator: { stats: { totalComments: 1 } },
    },
    ...rest,
  };
}

/** A tombstone: the site keeps deleted comments in place with no body and no profile. */
export function deletedComment(overrides: Partial<RawComment> = {}): RawComment {
  return {
    ...rawComment(overrides),
    accountId: '',
    content: null,
    plainTextContent: '',
    status: 'DELETED',
    deletedAt: '2026-09-21T10:00:00.000Z',
    profile: null,
    ...overrides,
  };
}

/** One page of the list: roots followed by their first-level replies, as both the seed and the list query send it. */
export function commentsPayload({
  comments = [],
  hasMore = false,
  cursor = hasMore ? 'cursor-2' : null,
  sortBy = 'NEW',
  parentId = null,
  docId = 'doc-1',
  error = null,
}: {
  comments?: RawComment[];
  hasMore?: boolean;
  cursor?: string | null;
  sortBy?: SortBy;
  parentId?: string | null;
  docId?: string;
  error?: RawCommentsPayload['error'];
} = {}): RawCommentsPayload {
  return {
    resourceId: resourceIdOf(docId),
    commentId: '',
    error,
    page: { hasMoreItems: hasMore, nextCursor: cursor },
    data: { parentId, sortBy, limit: 10, comments },
  };
}

export function commentsWidget({
  payload = commentsPayload(),
  isDisabled = false,
}: { payload?: RawCommentsPayload | null; isDisabled?: boolean } = {}): RawWidget {
  return {
    __typename: COMMENTS_TYPENAME,
    id: 'comments-widget',
    data: {
      isStickyInEditingMode: false,
      isStickyInViewMode: false,
      focusMode: { enabled: false },
      isDisabled,
      payload,
      commentsUiCapabilities: { loadingBehaviour: 'SHOW_MORE', sorting: { enabled: true, defaultSortingOption: 'NEW' } },
    },
  };
}

/** A copy of `doc` with its comments widget replaced (or removed with `widget: null`) and the site's counter set. */
export function withComments(
  doc: RawBuildDocument,
  { widget = commentsWidget(), totalComments = 0 }: { widget?: RawWidget | null; totalComments?: number | null } = {},
): RawBuildDocument {
  const content = doc.content.filter((w) => w.__typename !== COMMENTS_TYPENAME);
  return {
    ...doc,
    content: widget ? [...content, widget] : content,
    comments: totalComments === null ? null : { stats: { totalComments } },
  };
}

/** GraphQL responses of `NgfCommentsQuery` and `NgfCommentRepliesQuery`. */
export const listResponse = (payload: RawCommentsPayload) => ({ data: { comments: { comments: payload } } });
export const repliesResponse = (payload: RawCommentsPayload) => ({ data: { comments: { replies: payload } } });
