import { describe, expect, it } from 'vitest';
import { parseBuild } from '@/lib/build/parse-build';
import { scrubBuildDocument } from '@/lib/dev/scrub';
import { COMMENTS_TYPENAME, commentsPayload, commentsWidget, deletedComment, rawComment, withComments } from './fixtures/comments';
import { loadFixture } from './fixtures/load';

const doc = () => loadFixture('chaos-dot-lich-starter-deadrabbit').build;

describe('synthetic comment fixtures', () => {
  const root = rawComment({ id: 'r1', text: 'Which ring first?\nAsking for maps.' });
  const reply = rawComment({ id: 'a1', parentId: 'r1', text: 'Start with a rare.' });
  const widget = commentsWidget({ payload: commentsPayload({ comments: [root, reply, deletedComment({ id: 'd1' })], hasMore: true }) });

  it('replace the captured widget the way the site sends a discussion', () => {
    const withDiscussion = withComments(doc(), { widget, totalComments: 3 });
    const widgets = withDiscussion.content.filter((w) => w.__typename === COMMENTS_TYPENAME);

    expect(widgets).toEqual([widget]);
    expect(withDiscussion.comments).toEqual({ stats: { totalComments: 3 } });
    expect(reply.depth).toBe(1);
    expect(root.content).toMatchObject({ root: { children: [{ type: 'paragraph' }, { type: 'paragraph' }] } });
  });

  it('are dropped by the public-fixture scrub like real comments', () => {
    const scrubbed = scrubBuildDocument(withComments(doc(), { widget }));
    const kept = scrubbed.content.find((w) => w.__typename === COMMENTS_TYPENAME);

    expect(kept?.data.payload).toBeNull();
    expect(JSON.stringify(scrubbed)).not.toContain('Which ring first?');
  });

  it('do not change how the build itself is parsed', () => {
    expect(parseBuild(withComments(doc(), { widget }), null)).toEqual(parseBuild(doc(), null));
  });
});
