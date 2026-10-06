import { describe, expect, it } from 'vitest';
import { AUTHOR_ID, commentsPayload, rawComment, resourceIdOf } from '../../../tests/fixtures/comments';
import type { CommentsSeed } from '@/lib/comments/model';
import { parseCommentsPayload } from '@/lib/comments/parse-comments';
import type { CommentsSource } from '@/lib/comments/source';
import { probeComments } from './comments-probe';

const seed: CommentsSeed = {
  status: 'ready',
  resourceId: resourceIdOf('doc-1'),
  authorId: AUTHOR_ID,
  sort: 'NEW',
  canSort: true,
  total: 9,
  list: parseCommentsPayload(
    commentsPayload({ comments: [rawComment({ id: 'r1' }), rawComment({ id: 'a1', parentId: 'r1', replyCount: 1 })], hasMore: true }),
    AUTHOR_ID,
  )!,
};

describe('probeComments', () => {
  it('loads one more page and one missing thread through the real source, reporting counts only', async () => {
    const source: CommentsSource = {
      roots: async () => ({ ok: true, payload: commentsPayload({ comments: [rawComment({ id: 'r2', author: { id: AUTHOR_ID, name: 'A' } })] }) }),
      replies: async ({ parentId }) => ({ ok: true, payload: commentsPayload({ comments: [rawComment({ id: 'x1', parentId, depth: 2 })], parentId }) }),
    };

    expect(await probeComments(seed, source)).toEqual({
      seed: 'ready',
      total: 9,
      seedRoots: 1,
      seedMessages: 2,
      afterMore: { status: 'idle', roots: 2, hasMore: false },
      afterReplies: { status: 'idle', depth: 1, loaded: 1 },
      byAuthor: 1,
    });
  });

  it('reports errors by their technical reason', async () => {
    const source: CommentsSource = {
      roots: async () => ({ ok: false, error: { message: 'HTTP 403', retryAfterSeconds: null } }),
      replies: async () => ({ ok: false, error: { message: 'HTTP 403', retryAfterSeconds: null } }),
    };

    expect(await probeComments(seed, source)).toMatchObject({
      afterMore: { status: 'error', message: 'HTTP 403' },
      afterReplies: { status: 'error', message: 'HTTP 403' },
    });
  });

  it('only reports the seed when there is nothing to load', async () => {
    const source: CommentsSource = { roots: async () => ({ ok: false, error: { message: 'x', retryAfterSeconds: null } }), replies: async () => ({ ok: false, error: { message: 'x', retryAfterSeconds: null } }) };

    expect(await probeComments({ status: 'disabled' }, source)).toEqual({ seed: 'disabled' });
  });
});
