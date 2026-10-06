import { describe, expect, it, vi } from 'vitest';
import { AUTHOR_ID, commentsPayload, rawComment, resourceIdOf } from '../../../tests/fixtures/comments';
import { createCommentsController, hasMissingReplies, type CommentsState } from './controller';
import type { CommentsSeed } from './model';
import { parseCommentsPayload } from './parse-comments';
import type { CommentsSource, SourceResult } from './source';

const RESOURCE = resourceIdOf('doc-1');

interface Call {
  kind: 'roots' | 'replies' | 'post';
  input: Record<string, unknown>;
  signal: AbortSignal | undefined;
  resolve: (result: SourceResult) => void;
}

function fakeSource() {
  const calls: Call[] = [];
  const request =
    (kind: Call['kind']) =>
    (input: object, signal?: AbortSignal) =>
      new Promise<SourceResult>((resolve) => calls.push({ kind, input: input as Record<string, unknown>, signal, resolve }));
  const source: CommentsSource = { roots: request('roots'), replies: request('replies'), post: request('post') };
  return { source, calls };
}

const ok = (comments: ReturnType<typeof rawComment>[], extra: Parameters<typeof commentsPayload>[0] = {}): SourceResult => ({
  ok: true,
  payload: commentsPayload({ comments, ...extra }),
});
const fail = (message: string, retryAfterSeconds: number | null = null): SourceResult => ({ ok: false, error: { message, retryAfterSeconds } });

function readySeed(comments: ReturnType<typeof rawComment>[], extra: Parameters<typeof commentsPayload>[0] = {}): CommentsSeed {
  return {
    status: 'ready',
    resourceId: RESOURCE,
    authorId: AUTHOR_ID,
    sort: 'NEW',
    canSort: true,
    total: 12,
    list: parseCommentsPayload(commentsPayload({ comments, ...extra }), AUTHOR_ID)!,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function ready(state: CommentsState) {
  if (state.status !== 'ready') throw new Error(`expected ready, got ${state.status}`);
  return state;
}

function setup(seed: CommentsSeed, now = () => 1_000) {
  const { source, calls } = fakeSource();
  const controller = createCommentsController({ seed, source, now });
  return { controller, calls, state: () => controller.getState() };
}

const firstPage = () => readySeed([rawComment({ id: 'r1' }), rawComment({ id: 'a1', parentId: 'r1' }), rawComment({ id: 'r2' })], { hasMore: true, cursor: 'next-1' });

describe('createCommentsController', () => {
  it("starts from the page's own comments without asking the site", () => {
    const { state, calls } = setup(firstPage());

    expect(ready(state())).toMatchObject({ sort: 'NEW', canSort: true, total: 12, more: { status: 'idle' }, resort: { status: 'idle' } });
    expect(ready(state()).list.rootIds).toEqual(['r1', 'r2']);
    expect(calls).toHaveLength(0);
  });

  it('knows whether the build author can be told apart, so an Author replied filter makes sense', () => {
    expect(ready(setup(firstPage()).state()).canIdentifyAuthor).toBe(true);
    expect(ready(setup({ ...firstPage(), authorId: null } as CommentsSeed).state()).canIdentifyAuthor).toBe(false);
  });

  it('passes on disabled comments as they are', () => {
    expect(setup({ status: 'disabled' }).state()).toEqual({ status: 'disabled' });
  });

  describe('loadMore', () => {
    it('appends the next page of roots and their replies', async () => {
      const { controller, calls, state } = setup(firstPage());

      controller.loadMore();
      expect(ready(state()).more).toEqual({ status: 'loading' });
      expect(calls[0]).toMatchObject({ kind: 'roots', input: { resourceId: RESOURCE, sort: 'NEW', cursor: 'next-1' } });

      calls[0]!.resolve(ok([rawComment({ id: 'r3' }), rawComment({ id: 'b1', parentId: 'r3', author: { id: AUTHOR_ID, name: 'Author' } })], { hasMore: false }));
      await flush();

      const { list, more } = ready(state());
      expect(more).toEqual({ status: 'idle' });
      expect(list.rootIds).toEqual(['r1', 'r2', 'r3']);
      expect(list.replies).toEqual({ r1: ['a1'], r3: ['b1'] });
      expect(list.comments.b1!.author!.isBuildAuthor).toBe(true);
      expect(list.page).toEqual({ hasMore: false, cursor: null });
    });

    it('keeps one card per comment when a page repeats one, taking the newer copy', async () => {
      const { controller, calls, state } = setup(firstPage());

      controller.loadMore();
      calls[0]!.resolve(ok([rawComment({ id: 'r2', text: 'newer' }), rawComment({ id: 'r3' })]));
      await flush();

      expect(ready(state()).list.rootIds).toEqual(['r1', 'r2', 'r3']);
      expect(ready(state()).list.comments.r2!.plainText).toBe('newer');
    });

    it('sends one request however often it is asked while loading', () => {
      const { controller, calls } = setup(firstPage());

      controller.loadMore();
      controller.loadMore();

      expect(calls).toHaveLength(1);
    });

    it('does nothing when the site has no more roots', () => {
      const { controller, calls } = setup(readySeed([rawComment({ id: 'r1' })]));

      controller.loadMore();

      expect(calls).toHaveLength(0);
    });

    it('keeps what was read when a page fails, and waits out the delay the site asked for', async () => {
      let time = 1_000;
      const { controller, calls, state } = setup(firstPage(), () => time);

      controller.loadMore();
      calls[0]!.resolve(fail('RATE_LIMITED', 30));
      await flush();

      expect(ready(state()).more).toEqual({ status: 'error', message: 'RATE_LIMITED', retryAt: 31_000 });
      expect(ready(state()).list.rootIds).toEqual(['r1', 'r2']);

      controller.loadMore();
      expect(calls).toHaveLength(1);

      time = 31_000;
      controller.loadMore();
      expect(calls).toHaveLength(2);
    });

    it('can be tried again right away after an error without a delay', async () => {
      const { controller, calls, state } = setup(firstPage());

      controller.loadMore();
      calls[0]!.resolve(fail('HTTP 503'));
      await flush();
      expect(ready(state()).more).toEqual({ status: 'error', message: 'HTTP 503', retryAt: null });

      controller.loadMore();
      expect(calls).toHaveLength(2);
    });
  });

  describe('loadReplies', () => {
    const seedWithThread = () => readySeed([rawComment({ id: 'r1', replyCount: 3 }), rawComment({ id: 'a1', parentId: 'r1', replyCount: 1, createdAt: '2026-09-21T00:00:00Z' })]);

    it('knows which comments have replies that are not loaded yet', () => {
      const { state } = setup(seedWithThread());

      expect(hasMissingReplies(ready(state()), 'r1')).toBe(true);
      expect(hasMissingReplies(ready(state()), 'a1')).toBe(true);
      expect(hasMissingReplies(ready(state()), 'nope')).toBe(false);
    });

    it('loads replies oldest first and merges them into the thread without duplicates', async () => {
      const { controller, calls, state } = setup(seedWithThread());

      controller.loadReplies('r1');
      expect(ready(state()).replies.r1).toEqual({ load: { status: 'loading' }, page: null });
      expect(calls[0]).toMatchObject({ kind: 'replies', input: { parentId: 'r1', sort: 'OLD', cursor: null } });

      calls[0]!.resolve(
        ok(
          [
            rawComment({ id: 'a1', parentId: 'r1', createdAt: '2026-09-21T00:00:00Z' }),
            rawComment({ id: 'a2', parentId: 'r1', createdAt: '2026-09-22T00:00:00Z' }),
          ],
          { hasMore: true, cursor: 'replies-2', parentId: 'r1' },
        ),
      );
      await flush();

      expect(ready(state()).list.replies.r1).toEqual(['a1', 'a2']);
      expect(ready(state()).replies.r1).toEqual({ load: { status: 'idle' }, page: { hasMore: true, cursor: 'replies-2' } });
      expect(hasMissingReplies(ready(state()), 'r1')).toBe(true);

      controller.loadReplies('r1');
      expect(calls[1]).toMatchObject({ input: { parentId: 'r1', cursor: 'replies-2' } });
      calls[1]!.resolve(ok([rawComment({ id: 'a3', parentId: 'r1', createdAt: '2026-09-23T00:00:00Z' })], { parentId: 'r1' }));
      await flush();

      expect(ready(state()).list.replies.r1).toEqual(['a1', 'a2', 'a3']);
      expect(hasMissingReplies(ready(state()), 'r1')).toBe(false);
    });

    it('loads replies to a reply, which the list never includes', async () => {
      const { controller, calls, state } = setup(seedWithThread());

      controller.loadReplies('a1');
      calls[0]!.resolve(ok([rawComment({ id: 'x1', parentId: 'a1', depth: 2 })], { parentId: 'a1' }));
      await flush();

      expect(ready(state()).list.replies.a1).toEqual(['x1']);
      expect(ready(state()).list.comments.x1!.depth).toBe(2);
    });

    it('keeps a failed thread to itself and sends one request per thread at a time', async () => {
      const { controller, calls, state } = setup(seedWithThread());

      controller.loadReplies('r1');
      controller.loadReplies('r1');
      controller.loadReplies('a1');
      expect(calls).toHaveLength(2);

      calls[0]!.resolve(fail('HTTP 500'));
      await flush();

      expect(ready(state()).replies.r1!.load).toEqual({ status: 'error', message: 'HTTP 500', retryAt: null });
      expect(ready(state()).replies.a1!.load).toEqual({ status: 'loading' });
      expect(ready(state()).list.rootIds).toEqual(['r1']);
    });
  });

  describe('setSort', () => {
    it('loads the first page in the new order and replaces the list', async () => {
      const { controller, calls, state } = setup(firstPage());

      controller.setSort('OLD');
      expect(ready(state())).toMatchObject({ sort: 'NEW', resort: { status: 'loading' } });
      expect(calls[0]).toMatchObject({ kind: 'roots', input: { resourceId: RESOURCE, sort: 'OLD', cursor: null } });

      calls[0]!.resolve(ok([rawComment({ id: 'old1' })], { hasMore: true, cursor: 'old-2', sortBy: 'OLD' }));
      await flush();

      const next = ready(state());
      expect(next).toMatchObject({ sort: 'OLD', resort: { status: 'idle' }, replies: {} });
      expect(next.list.rootIds).toEqual(['old1']);

      controller.loadMore();
      expect(calls[1]).toMatchObject({ input: { sort: 'OLD', cursor: 'old-2' } });
    });

    it('drops pages of the previous order that arrive late', async () => {
      const { controller, calls, state } = setup(firstPage());

      controller.loadMore();
      controller.loadReplies('r1');
      controller.setSort('TOP');

      expect(calls[0]!.signal!.aborted).toBe(true);
      expect(calls[1]!.signal!.aborted).toBe(true);

      calls[2]!.resolve(ok([rawComment({ id: 'top1' })], { sortBy: 'TOP' }));
      calls[0]!.resolve(ok([rawComment({ id: 'late' })]));
      calls[1]!.resolve(ok([rawComment({ id: 'late-reply', parentId: 'r1' })]));
      await flush();

      expect(ready(state()).list.rootIds).toEqual(['top1']);
      expect(ready(state()).list.comments.late).toBeUndefined();
      expect(ready(state()).more).toEqual({ status: 'idle' });
    });

    it('keeps the current order and list when the new order fails to load', async () => {
      const { controller, calls, state } = setup(firstPage());

      controller.setSort('OLD');
      calls[0]!.resolve(fail('HTTP 502'));
      await flush();

      expect(ready(state())).toMatchObject({ sort: 'NEW', resort: { status: 'error', message: 'HTTP 502' } });
      expect(ready(state()).list.rootIds).toEqual(['r1', 'r2']);
    });

    it('ignores the current order and sites that do not sort', () => {
      const same = setup(firstPage());
      same.controller.setSort('NEW');
      expect(same.calls).toHaveLength(0);

      const fixed = setup({ ...firstPage(), canSort: false } as CommentsSeed);
      fixed.controller.setSort('OLD');
      expect(fixed.calls).toHaveLength(0);
    });
  });

  describe('retry of an unavailable discussion', () => {
    it("loads the first page from the site's API when the page did not carry it", async () => {
      const { controller, calls, state } = setup({ status: 'unavailable', resourceId: RESOURCE, authorId: AUTHOR_ID, total: 5 });
      expect(state()).toEqual({ status: 'unavailable', canRetry: true, total: 5, load: { status: 'idle' } });

      controller.retry();
      expect(state()).toMatchObject({ status: 'unavailable', load: { status: 'loading' } });
      expect(calls[0]).toMatchObject({ kind: 'roots', input: { resourceId: RESOURCE, sort: 'NEW', cursor: null } });

      calls[0]!.resolve(ok([rawComment({ id: 'r1', author: { id: AUTHOR_ID, name: 'Author' } })], { hasMore: true, cursor: 'c2' }));
      await flush();

      expect(ready(state())).toMatchObject({ sort: 'NEW', canSort: true, total: 5, more: { status: 'idle' } });
      expect(ready(state()).list.comments.r1!.author!.isBuildAuthor).toBe(true);
    });

    it('stays unavailable with the reason when that fails', async () => {
      const { controller, calls, state } = setup({ status: 'unavailable', resourceId: RESOURCE, authorId: null, total: null });

      controller.retry();
      calls[0]!.resolve(fail('HTTP 403'));
      await flush();

      expect(state()).toEqual({ status: 'unavailable', canRetry: true, total: null, load: { status: 'error', message: 'HTTP 403', retryAt: null } });
    });

    it('has nothing to retry when the page has no comments section', () => {
      const { controller, calls, state } = setup({ status: 'unavailable', resourceId: null, authorId: null, total: null });

      controller.retry();

      expect(state()).toMatchObject({ canRetry: false, load: { status: 'idle' } });
      expect(calls).toHaveLength(0);
    });
  });

  describe('post', () => {
    const created = (comment: ReturnType<typeof rawComment>, rejectionReason: string | null = null): SourceResult => ({
      ok: true,
      payload: { ...comment, rejectionReason },
    });

    it('publishes a new comment and shows it first, counting it in', async () => {
      const { controller, calls, state } = setup(firstPage());

      const posted = controller.post(null, '  Thanks for the guide!  ');
      expect(calls[0]).toMatchObject({ kind: 'post', input: { resourceId: RESOURCE, parentId: null, text: 'Thanks for the guide!' } });
      calls[0]!.resolve(created(rawComment({ id: 'mine', text: 'Thanks for the guide!', author: { id: 'acc-me', name: 'Me' } })));

      expect(await posted).toEqual({ ok: true });
      expect(ready(state()).list.rootIds).toEqual(['mine', 'r1', 'r2']);
      expect(ready(state()).list.comments.mine!.plainText).toBe('Thanks for the guide!');
      expect(ready(state()).total).toBe(13);
    });

    it('adds a reply at the end of its thread, counting it on the parent', async () => {
      const { controller, calls, state } = setup(firstPage());

      const posted = controller.post('r1', 'Agreed');
      expect(calls[0]).toMatchObject({ input: { parentId: 'r1', text: 'Agreed' } });
      calls[0]!.resolve(created(rawComment({ id: 'mine', parentId: 'r1', text: 'Agreed', author: { id: AUTHOR_ID, name: 'Author' } })));

      expect(await posted).toEqual({ ok: true });
      expect(ready(state()).list.replies.r1).toEqual(['a1', 'mine']);
      expect(ready(state()).list.comments.r1!.replyCount).toBe(1);
      expect(ready(state()).list.comments.mine!.author!.isBuildAuthor).toBe(true);
    });

    it('says when the visitor has to sign in on the site first', async () => {
      const { controller, calls, state } = setup(firstPage());

      const posted = controller.post(null, 'Hi');
      calls[0]!.resolve(fail('FORBIDDEN'));

      expect(await posted).toEqual({ ok: false, reason: 'signed-out', message: 'FORBIDDEN', retryAt: null });
      expect(ready(state()).list.rootIds).toEqual(['r1', 'r2']);
    });

    it('passes on why the site turned a comment down, and when to try again', async () => {
      const { controller, calls } = setup(firstPage());

      const rejected = controller.post(null, 'spam');
      calls[0]!.resolve(created(rawComment({ id: 'x' }), 'Looks like spam'));
      expect(await rejected).toEqual({ ok: false, reason: 'rejected', message: 'Looks like spam', retryAt: null });

      const limited = controller.post(null, 'again');
      calls[1]!.resolve(fail('RATE_LIMITED', 20));
      expect(await limited).toEqual({ ok: false, reason: 'failed', message: 'RATE_LIMITED', retryAt: 21_000 });
    });

    it('sends nothing for empty text or a discussion it cannot write to', async () => {
      const { controller, calls } = setup(firstPage());
      expect(await controller.post(null, '  \n ')).toMatchObject({ ok: false, reason: 'failed' });

      const disabled = setup({ status: 'disabled' });
      expect(await disabled.controller.post(null, 'Hi')).toMatchObject({ ok: false });
      expect([...calls, ...disabled.calls]).toHaveLength(0);
    });
  });

  it('tells subscribers about every change until they unsubscribe', async () => {
    const { controller, calls } = setup(firstPage());
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    controller.loadMore();
    calls[0]!.resolve(ok([]));
    await flush();
    unsubscribe();
    controller.loadReplies('r1');

    expect(listener.mock.calls.map(([s]) => (s as CommentsState & { more?: unknown }).more)).toEqual([{ status: 'loading' }, { status: 'idle' }]);
  });

  it('cancels its requests and goes quiet once disposed, as when the reader moves to another build', async () => {
    const { controller, calls, state } = setup(firstPage());
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.loadMore();
    listener.mockClear();

    controller.dispose();
    expect(calls[0]!.signal!.aborted).toBe(true);

    calls[0]!.resolve(ok([rawComment({ id: 'late' })]));
    await flush();
    controller.loadReplies('r1');

    expect(listener).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(ready(state()).list.comments.late).toBeUndefined();
  });

  it('treats a rejected request (cancelled or broken) as finished without touching the list', async () => {
    const { source } = fakeSource();
    source.roots = () => Promise.reject(new Error('boom'));
    const controller = createCommentsController({ seed: firstPage(), source, now: () => 0 });

    controller.loadMore();
    await flush();

    expect(ready(controller.getState()).more).toEqual({ status: 'error', message: 'boom', retryAt: null });
  });
});
