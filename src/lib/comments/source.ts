import type { CommentsSort } from './model';

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
}

const PAGE_SIZE = 10;
const ENDPOINT_PATH = '/api/poe-2/v1/graphql/query';

const PAYLOAD_FIELDS = `
  resourceId
  commentId
  error { code message retryAfterSeconds }
  page { hasMoreItems nextCursor }
  data {
    parentId
    sortBy
    limit
    comments {
      id parentId resourceId depth accountId content plainTextContent status createdAt isSpoiler spoilerLabel replyCount
      profile { user { id username displayName } avatar { iconUrl } }
    }
  }`;

const ROOTS_QUERY = `query NgfCommentsQuery($input: CommentsListInput!) { comments { comments(input: $input) { ${PAYLOAD_FIELDS} } } }`;
const REPLIES_QUERY = `query NgfCommentRepliesQuery($input: CommentsRepliesInput!) { comments { replies(input: $input) { ${PAYLOAD_FIELDS} } } }`;

const UNEXPECTED: CommentsError = { message: 'unexpected answer', retryAfterSeconds: null };

/** `fetch` should ask as the page itself (see `pageFetch`); `origin` is the page's, so the request stays same-origin. */
export function createCommentsSource({ fetch: fetchImpl, origin }: { fetch: typeof fetch; origin: string }): CommentsSource {
  const endpoint = new URL(ENDPOINT_PATH, origin).href;

  const ask = async (operationName: string, query: string, field: 'comments' | 'replies', input: object, signal?: AbortSignal): Promise<SourceResult> => {
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
  };
}

export function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

function seconds(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}
