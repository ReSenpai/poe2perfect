import { describe, expect, it } from 'vitest';
import type { RawBuildDocument } from '@/lib/data/types';
import {
  AUTHOR_ID,
  commentsPayload,
  commentsWidget,
  deletedComment,
  lexicalBody,
  rawComment,
  resourceIdOf,
  withComments,
} from '../../../tests/fixtures/comments';
import { parseCommentsPayload, parseCommentsSeed } from './parse-comments';

const baseDoc = (): RawBuildDocument => ({
  id: 'doc-1',
  data: { name: 'Build' },
  content: [],
  author: { id: AUTHOR_ID, name: 'Author', user: { username: 'author', displayName: 'Author' } },
});

const seedOf = (comments: Parameters<typeof commentsPayload>[0] = {}, totalComments: number | null = 0) =>
  parseCommentsSeed(withComments(baseDoc(), { widget: commentsWidget({ payload: commentsPayload(comments) }), totalComments }));

const ready = (seed: ReturnType<typeof parseCommentsSeed>) => {
  if (seed.status !== 'ready') throw new Error(`expected a ready seed, got ${seed.status}`);
  return seed;
};

describe('parseCommentsSeed', () => {
  it('is unavailable, not empty, when the page has no comments widget', () => {
    expect(parseCommentsSeed(baseDoc())).toEqual({ status: 'unavailable' });
  });

  it('is unavailable when the widget carries no payload or an unreadable one', () => {
    for (const payload of [null, { data: { comments: 'nope' } }, 'x']) {
      const doc = withComments(baseDoc(), { widget: commentsWidget({ payload: payload as never }) });
      expect(parseCommentsSeed(doc)).toEqual({ status: 'unavailable' });
    }
  });

  it('is unavailable when the site reports an error instead of comments', () => {
    const error = { code: 'RATE_LIMITED', message: 'slow down', retryAfterSeconds: 5 };
    expect(parseCommentsSeed(withComments(baseDoc(), { widget: commentsWidget({ payload: commentsPayload({ error }) }) }))).toEqual({
      status: 'unavailable',
    });
  });

  it('is disabled when the author turned comments off', () => {
    const doc = withComments(baseDoc(), { widget: commentsWidget({ isDisabled: true, payload: null }) });
    expect(parseCommentsSeed(doc)).toEqual({ status: 'disabled' });
  });

  it('reads an empty, complete discussion as ready with no comments', () => {
    const seed = ready(seedOf({ comments: [], hasMore: false }, 0));

    expect(seed.list.rootIds).toEqual([]);
    expect(seed.list.page).toEqual({ hasMore: false, cursor: null });
    expect(seed.total).toBe(0);
  });

  it("keeps the site's counter, its resource id, sort order and continuation", () => {
    const seed = ready(seedOf({ comments: [rawComment({ id: 'r1' })], hasMore: true, cursor: 'next-1', sortBy: 'NEW' }, 30));

    expect(seed).toMatchObject({ resourceId: resourceIdOf('doc-1'), sort: 'NEW', canSort: true, total: 30 });
    expect(seed.list.page).toEqual({ hasMore: true, cursor: 'next-1' });
  });

  it('leaves the counter unknown when the document has none', () => {
    expect(ready(seedOf({}, null)).total).toBeNull();
  });
});

describe('parseCommentsPayload', () => {
  const parse = (comments: ReturnType<typeof rawComment>[], extra: Parameters<typeof commentsPayload>[0] = {}) =>
    parseCommentsPayload(commentsPayload({ comments, ...extra }), AUTHOR_ID)!;

  it('splits roots in source order from replies grouped under their parent, oldest reply first', () => {
    const list = parse([
      rawComment({ id: 'r2', createdAt: '2026-09-22T00:00:00Z' }),
      rawComment({ id: 'r1', createdAt: '2026-09-20T00:00:00Z' }),
      rawComment({ id: 'b', parentId: 'r2', createdAt: '2026-09-24T00:00:00Z' }),
      rawComment({ id: 'a', parentId: 'r2', createdAt: '2026-09-23T00:00:00Z' }),
    ]);

    expect(list.rootIds).toEqual(['r2', 'r1']);
    expect(list.replies).toEqual({ r2: ['a', 'b'] });
    expect(list.comments.a).toMatchObject({ parentId: 'r2', depth: 1 });
  });

  it('normalizes a comment: author, body, plain text, date, reply count', () => {
    const list = parse([
      rawComment({
        id: 'r1',
        text: 'Line one\nLine two',
        createdAt: '2026-09-20T10:00:00.000Z',
        replyCount: 2,
        author: { id: 'acc-frost', name: 'Frost Runner', avatarUrl: 'https://cdn.example/a.png' },
      }),
    ]);

    expect(list.comments.r1).toEqual({
      id: 'r1',
      parentId: null,
      depth: 0,
      author: { id: 'acc-frost', name: 'Frost Runner', avatarUrl: 'https://cdn.example/a.png', isBuildAuthor: false },
      body: lexicalBody('Line one', 'Line two'),
      plainText: 'Line one\nLine two',
      createdAt: '2026-09-20T10:00:00.000Z',
      deleted: false,
      spoiler: null,
      replyCount: 2,
    });
  });

  it('marks the build author only by account id, never by a matching name', () => {
    const list = parse([
      rawComment({ id: 'own', author: { id: AUTHOR_ID, name: 'Someone' } }),
      rawComment({ id: 'namesake', author: { id: 'acc-other', name: 'Author' } }),
    ]);

    expect(list.comments.own!.author!.isBuildAuthor).toBe(true);
    expect(list.comments.namesake!.author!.isBuildAuthor).toBe(false);
  });

  it('cannot tell the author apart when the document names no author id', () => {
    const list = parseCommentsPayload(commentsPayload({ comments: [rawComment({ id: 'x', author: { id: '', name: 'Ghost' } })] }), null)!;
    expect(list.comments.x!.author!.isBuildAuthor).toBe(false);
  });

  it('keeps a deleted comment in place as a tombstone, with its replies', () => {
    const list = parse([deletedComment({ id: 'd1', replyCount: 1 }), rawComment({ id: 'r', parentId: 'd1' })]);

    expect(list.comments.d1).toMatchObject({ deleted: true, author: null, body: null, plainText: '' });
    expect(list.replies.d1).toEqual(['r']);
  });

  it('hides a spoiler behind its label, falling back to a generic one', () => {
    const list = parse([
      rawComment({ id: 's1', isSpoiler: true, spoilerLabel: 'Boss mechanics' }),
      rawComment({ id: 's2', isSpoiler: true, spoilerLabel: '' }),
    ]);

    expect(list.comments.s1!.spoiler).toBe('Boss mechanics');
    expect(list.comments.s2!.spoiler).toBe('Spoiler');
  });

  it('falls back to the username, then to a neutral name, and drops non-https avatars', () => {
    const noDisplay = rawComment({ id: 'u1' });
    noDisplay.profile!.user.displayName = '';
    noDisplay.profile!.avatar = { id: 'a', name: 'a', iconUrl: 'javascript:alert(1)' };
    const anonymous = rawComment({ id: 'u2', profile: null });

    const list = parse([noDisplay, anonymous]);

    expect(list.comments.u1!.author).toMatchObject({ name: noDisplay.profile!.user.username, avatarUrl: null });
    expect(list.comments.u2!.author).toMatchObject({ name: 'Unknown user', avatarUrl: null });
  });

  it('keeps the plain text when the body is missing, and no invented date when it is unreadable', () => {
    const list = parse([rawComment({ id: 'p', content: null, text: 'Just text', createdAt: 'yesterday' })]);

    expect(list.comments.p).toMatchObject({ body: null, plainText: 'Just text', createdAt: null });
  });

  it('keeps one card per id when the site repeats a comment', () => {
    const list = parse([rawComment({ id: 'r1', text: 'old' }), rawComment({ id: 'a', parentId: 'r1' }), rawComment({ id: 'r1', text: 'new' }), rawComment({ id: 'a', parentId: 'r1' })]);

    expect(list.rootIds).toEqual(['r1']);
    expect(list.replies.r1).toEqual(['a']);
    expect(list.comments.r1!.plainText).toBe('new');
  });

  it('skips entries that are not comments without failing the rest', () => {
    const payload = commentsPayload({ comments: [rawComment({ id: 'ok' })] });
    (payload.data.comments as unknown[]).push(null, 'x', { id: 42 }, { parentId: 'ok' });

    const list = parseCommentsPayload(payload, AUTHOR_ID)!;

    expect(list.rootIds).toEqual(['ok']);
    expect(Object.keys(list.comments)).toEqual(['ok']);
  });

  it('returns null for a payload that holds no comment list', () => {
    expect(parseCommentsPayload(null, AUTHOR_ID)).toBeNull();
    expect(parseCommentsPayload({ data: {} }, AUTHOR_ID)).toBeNull();
    expect(parseCommentsPayload(commentsPayload({ error: { code: 'X', message: 'y', retryAfterSeconds: null } }), AUTHOR_ID)).toBeNull();
  });
});
