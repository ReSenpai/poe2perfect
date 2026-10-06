import { textToLexical } from './lexical';
import type { CommentsSort, Vote } from './model';

/** Why a page didn't come: short and technical (`HTTP 429`, the site's error code); the UI words it. */
export interface CommentsError {
  message: string;
  retryAfterSeconds: number | null;
}

/** The raw `CommentsPayload` (parsed by `parseCommentsPayload`), or why there is none. */
export type SourceResult = { ok: true; payload: unknown } | { ok: false; error: CommentsError };

/**
 * The site's comment API, read the way its own page reads it. A cancelled request rejects (`AbortError`) instead of
 * resolving, so a stale answer is never mistaken for a result or a failure.
 */
export interface CommentsSource {
  roots(input: { resourceId: string; sort: CommentsSort; cursor: string | null }, signal?: AbortSignal): Promise<SourceResult>;
  replies(input: { parentId: string; sort: CommentsSort; cursor: string | null }, signal?: AbortSignal): Promise<SourceResult>;
  /**
   * Publishes `text` as the signed-in visitor: on the build, or as an answer to `parentId`. The payload is the new raw
   * comment with the site's `rejectionReason`. Only ever called for an explicit action of the reader.
   */
  post(input: { resourceId: string; parentId: string | null; text: string }): Promise<SourceResult>;
  /** Votes as the signed-in visitor (`null` takes the vote back); the payload holds the new `upvotes` and `downvotes`. */
  vote(input: { commentId: string; value: Vote | null }): Promise<SourceResult>;
}

const PAGE_SIZE = 10;
const ENDPOINT_PATH = '/api/poe-2/v1/graphql/query';

const COMMENT_FIELDS = `
  id parentId resourceId depth accountId content plainTextContent status createdAt isSpoiler spoilerLabel replyCount
  score viewerVote
  profile { user { id username displayName } avatar { iconUrl } }`;

const PAYLOAD_FIELDS = `
  resourceId
  commentId
  error { code message retryAfterSeconds }
  page { hasMoreItems nextCursor }
  data {
    parentId
    sortBy
    limit
    comments { ${COMMENT_FIELDS} }
  }`;

const ROOTS_QUERY = `query NgfCommentsQuery($input: CommentsListInput!) { comments { comments(input: $input) { ${PAYLOAD_FIELDS} } } }`;
const REPLIES_QUERY = `query NgfCommentRepliesQuery($input: CommentsRepliesInput!) { comments { replies(input: $input) { ${PAYLOAD_FIELDS} } } }`;

const CREATE_FIELDS = `data { ${COMMENT_FIELDS} rejectionReason } error { code message retryAfterSeconds }`;
const CREATE_COMMENT = `mutation NgfCreateCommentMutation($input: CommentsCreateCommentInput!) { comments { createComment(input: $input) { ${CREATE_FIELDS} } } }`;
const CREATE_REPLY = `mutation NgfCreateReplyMutation($input: CommentsCreateReplyInput!) { comments { createReply(input: $input) { ${CREATE_FIELDS} } } }`;

const VOTE_FIELDS = `data { commentId upvotes downvotes } error { code message retryAfterSeconds }`;
const VOTE = `mutation NgfCommentVoteMutation($input: CommentsVoteInput!) { comments { vote(input: $input) { ${VOTE_FIELDS} } } }`;
const DELETE_VOTE = `mutation NgfCommentDeleteVoteMutation($input: CommentsDeleteVoteInput!) { comments { deleteVote(input: $input) { ${VOTE_FIELDS} } } }`;

type Field = 'comments' | 'replies' | 'createComment' | 'createReply' | 'vote' | 'deleteVote';
/** Fields whose answer wraps its result in `data`. */
const UNWRAPPED: Field[] = ['createComment', 'createReply', 'vote', 'deleteVote'];

const UNEXPECTED: CommentsError = { message: 'unexpected answer', retryAfterSeconds: null };

/**
 * `fetch` should ask as the page itself (see `pageFetch`); `origin` is the page's, so the request stays same-origin and
 * carries the visitor's session, which is how the site knows who posts. `pageUrl` is the build page a new comment links
 * back to.
 */
export function createCommentsSource({
  fetch: fetchImpl,
  origin,
  pageUrl = () => origin,
}: {
  fetch: typeof fetch;
  origin: string;
  pageUrl?: () => string;
}): CommentsSource {
  const endpoint = new URL(ENDPOINT_PATH, origin).href;

  const ask = async (operationName: string, query: string, field: Field, input: object, signal?: AbortSignal): Promise<SourceResult> => {
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ operationName, query, variables: { input } }),
        signal,
      });
    } catch (error) {
      if (isAbort(error)) throw error;
      return { ok: false, error: { message: 'network error', retryAfterSeconds: null } };
    }

    if (!response.ok) {
      return { ok: false, error: { message: `HTTP ${response.status}`, retryAfterSeconds: seconds(response.headers.get('retry-after')) } };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (isAbort(error)) throw error;
      return { ok: false, error: UNEXPECTED };
    }

    const payload = (body as { data?: { comments?: Record<string, unknown> } } | null)?.data?.comments?.[field];
    if (!payload || typeof payload !== 'object') return { ok: false, error: UNEXPECTED };
    const siteError = (payload as { error?: { code?: unknown; message?: unknown; retryAfterSeconds?: unknown } | null }).error;
    if (siteError) {
      const message = typeof siteError.code === 'string' && siteError.code ? siteError.code : String(siteError.message ?? 'error');
      return { ok: false, error: { message, retryAfterSeconds: seconds(siteError.retryAfterSeconds) } };
    }
    if (UNWRAPPED.includes(field)) {
      const created = (payload as { data?: unknown }).data;
      return created && typeof created === 'object' ? { ok: true, payload: created } : { ok: false, error: UNEXPECTED };
    }
    return { ok: true, payload };
  };

  const page = (input: Record<string, unknown>, sort: CommentsSort, cursor: string | null) => ({
    ...input,
    sortBy: sort,
    limit: PAGE_SIZE,
    ...(cursor ? { cursor } : {}),
  });

  return {
    roots: ({ resourceId, sort, cursor }, signal) => ask('NgfCommentsQuery', ROOTS_QUERY, 'comments', page({ resourceId }, sort, cursor), signal),
    replies: ({ parentId, sort, cursor }, signal) => ask('NgfCommentRepliesQuery', REPLIES_QUERY, 'replies', page({ parentId }, sort, cursor), signal),
    post: ({ resourceId, parentId, text }) => {
      const body = { content: textToLexical(text), sourceUrl: pageUrl() };
      return parentId
        ? ask('NgfCreateReplyMutation', CREATE_REPLY, 'createReply', { parentId, ...body })
        : ask('NgfCreateCommentMutation', CREATE_COMMENT, 'createComment', { resourceId, ...body });
    },
    vote: ({ commentId, value }) =>
      value
        ? ask('NgfCommentVoteMutation', VOTE, 'vote', { commentId, value: value === 'up' ? 'UPVOTE' : 'DOWNVOTE' })
        : ask('NgfCommentDeleteVoteMutation', DELETE_VOTE, 'deleteVote', { commentId }),
  };
}

export function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

function seconds(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}
