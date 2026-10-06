import { describe, expect, it, vi } from 'vitest';
import { commentsPayload, listResponse, rawComment, repliesResponse } from '../../../tests/fixtures/comments';
import { createCommentsSource } from './source';

const ORIGIN = 'https://mobalytics.gg';
const ENDPOINT = `${ORIGIN}/api/poe-2/v1/graphql/query`;

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

function setup(respond: () => Response | Promise<Response>) {
  const fetchImpl = vi.fn<typeof fetch>(async () => respond());
  const source = createCommentsSource({ fetch: fetchImpl, origin: ORIGIN });
  const sent = () => {
    const [url, init] = fetchImpl.mock.calls[0]!;
    return { url, init: init!, body: JSON.parse(String(init!.body)) as { operationName: string; query: string; variables: { input: Record<string, unknown> } } };
  };
  return { fetchImpl, source, sent };
}

describe('createCommentsSource', () => {
  it("asks the site's comment list for a page of root comments", async () => {
    const payload = commentsPayload({ comments: [rawComment({ id: 'r1' })], hasMore: true });
    const { source, sent } = setup(() => json(listResponse(payload)));

    const result = await source.roots({ resourceId: 'Poe2:UG:doc-1', sort: 'OLD', cursor: 'next-1' });

    expect(result).toEqual({ ok: true, payload });
    const { url, init, body } = sent();
    expect(url).toBe(ENDPOINT);
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' } });
    expect(body.operationName).toBe('NgfCommentsQuery');
    expect(body.query).toContain('comments(input: $input)');
    expect(body.variables.input).toEqual({ resourceId: 'Poe2:UG:doc-1', sortBy: 'OLD', limit: 10, cursor: 'next-1' });
  });

  it('leaves the cursor out for the first page', async () => {
    const { source, sent } = setup(() => json(listResponse(commentsPayload())));

    await source.roots({ resourceId: 'Poe2:UG:doc-1', sort: 'NEW', cursor: null });

    expect(sent().body.variables.input).toEqual({ resourceId: 'Poe2:UG:doc-1', sortBy: 'NEW', limit: 10 });
  });

  it('asks for the replies to one comment', async () => {
    const payload = commentsPayload({ comments: [rawComment({ id: 'a', parentId: 'r1' })], parentId: 'r1' });
    const { source, sent } = setup(() => json(repliesResponse(payload)));

    const result = await source.replies({ parentId: 'r1', sort: 'OLD', cursor: null });

    expect(result).toEqual({ ok: true, payload });
    expect(sent().body.operationName).toBe('NgfCommentRepliesQuery');
    expect(sent().body.query).toContain('replies(input: $input)');
    expect(sent().body.variables.input).toEqual({ parentId: 'r1', sortBy: 'OLD', limit: 10 });
  });

  it('asks for every field the parser reads', async () => {
    const { source, sent } = setup(() => json(listResponse(commentsPayload())));
    await source.roots({ resourceId: 'x', sort: 'NEW', cursor: null });

    for (const field of ['hasMoreItems', 'nextCursor', 'retryAfterSeconds', 'parentId', 'depth', 'accountId', 'content', 'plainTextContent', 'status', 'createdAt', 'isSpoiler', 'spoilerLabel', 'replyCount', 'displayName', 'iconUrl']) {
      expect(sent().body.query).toContain(field);
    }
  });

  it("passes on the site's own error with its retry delay", async () => {
    const error = { code: 'RATE_LIMITED', message: 'Too many requests', retryAfterSeconds: 30 };
    const { source } = setup(() => json(listResponse(commentsPayload({ error }))));

    expect(await source.roots({ resourceId: 'x', sort: 'NEW', cursor: null })).toEqual({ ok: false, error: { message: 'RATE_LIMITED', retryAfterSeconds: 30 } });
  });

  it('reports an HTTP failure by its status, with Retry-After when given', async () => {
    const { source } = setup(() => new Response('slow down', { status: 429, headers: { 'retry-after': '12' } }));
    expect(await source.roots({ resourceId: 'x', sort: 'NEW', cursor: null })).toEqual({ ok: false, error: { message: 'HTTP 429', retryAfterSeconds: 12 } });

    const blocked = setup(() => new Response('', { status: 403 }));
    expect(await blocked.source.roots({ resourceId: 'x', sort: 'NEW', cursor: null })).toEqual({ ok: false, error: { message: 'HTTP 403', retryAfterSeconds: null } });
  });

  it('reports an answer it cannot read', async () => {
    for (const body of [{ errors: [{ message: 'unknown field input value at `$input.x` …' }] }, { data: null }, 'not json']) {
      const { source } = setup(() => (typeof body === 'string' ? new Response(body) : json(body)));
      expect(await source.replies({ parentId: 'r1', sort: 'OLD', cursor: null })).toEqual({
        ok: false,
        error: { message: 'unexpected answer', retryAfterSeconds: null },
      });
    }
  });

  it('reports a request that never reached the site', async () => {
    const { source } = setup(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await source.roots({ resourceId: 'x', sort: 'NEW', cursor: null })).toEqual({ ok: false, error: { message: 'network error', retryAfterSeconds: null } });
  });

  it('lets a cancelled request reject, so stale answers are never mistaken for failures', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>((_url, init) => {
      expect(init?.signal).toBe(controller.signal);
      controller.abort();
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });
    const source = createCommentsSource({ fetch: fetchImpl, origin: ORIGIN });

    await expect(source.roots({ resourceId: 'x', sort: 'NEW', cursor: null }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
