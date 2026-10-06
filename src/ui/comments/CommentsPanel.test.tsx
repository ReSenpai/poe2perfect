import { act, fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { AUTHOR_ID, commentsPayload, deletedComment, rawComment, resourceIdOf } from '../../../tests/fixtures/comments';
import { createCommentsController } from '@/lib/comments/controller';
import type { CommentsSeed } from '@/lib/comments/model';
import { parseCommentsPayload } from '@/lib/comments/parse-comments';
import type { CommentsSource, SourceResult } from '@/lib/comments/source';
import { CommentsPanel } from './CommentsPanel';

const NOW = Date.parse('2026-10-06T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

type Pending = { kind: 'roots' | 'replies'; input: Record<string, unknown>; resolve: (result: SourceResult) => void };

function fakeSource() {
  const calls: Pending[] = [];
  const ask = (kind: Pending['kind']) => (input: object) =>
    new Promise<SourceResult>((resolve) => calls.push({ kind, input: input as Record<string, unknown>, resolve }));
  const source: CommentsSource = { roots: ask('roots'), replies: ask('replies') };
  return { source, calls };
}

const ok = (comments: ReturnType<typeof rawComment>[], extra: Parameters<typeof commentsPayload>[0] = {}): SourceResult => ({
  ok: true,
  payload: commentsPayload({ comments, ...extra }),
});

function readySeed(comments: ReturnType<typeof rawComment>[], extra: Parameters<typeof commentsPayload>[0] = {}, total: number | null = 24): CommentsSeed {
  return {
    status: 'ready',
    resourceId: resourceIdOf('doc-1'),
    authorId: AUTHOR_ID,
    sort: 'NEW',
    canSort: true,
    total,
    list: parseCommentsPayload(commentsPayload({ comments, ...extra }), AUTHOR_ID)!,
  };
}

function renderPanel(seed: CommentsSeed) {
  const { source, calls } = fakeSource();
  const controller = createCommentsController({ seed, source, now: () => NOW });
  const view = render(<CommentsPanel controller={controller} now={() => NOW} />);
  const settle = async (index: number, result: SourceResult) => {
    await act(async () => {
      calls[index]!.resolve(result);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };
  return { ...view, calls, settle, controller };
}

const frost = { id: 'acc-frost', name: 'FrostRunner', avatarUrl: 'https://cdn.example/frost.png' };
const author = { id: AUTHOR_ID, name: 'MisoxShiru' };
const ashen = { id: 'acc-ashen', name: 'AshenExile' };

const card = (name: string) => screen.getByText(name, { selector: '.comment__name' }).closest('article')!;

describe('CommentsPanel', () => {
  it("names the discussion, the site's counter and that it covers every variant", () => {
    renderPanel(readySeed([rawComment({ id: 'r1' })]));

    expect(screen.getByRole('heading', { level: 2, name: /Comments/ }).textContent).toContain('24');
    expect(screen.getByText('Discussion from the original build page')).toBeTruthy();
    expect(screen.getByText('All build variants')).toBeTruthy();
  });

  it('shows each root comment with its author, time and text, in the order the site sent them', () => {
    renderPanel(
      readySeed([
        rawComment({ id: 'r1', author: frost, text: 'Is there a budget ring?', createdAt: hoursAgo(2) }),
        rawComment({ id: 'r2', author: ashen, text: 'Which gem first?', createdAt: hoursAgo(5) }),
      ]),
    );

    const names = screen.getAllByText(/FrostRunner|AshenExile/, { selector: '.comment__name' }).map((el) => el.textContent);
    expect(names).toEqual(['FrostRunner', 'AshenExile']);
    const first = within(card('FrostRunner'));
    expect(first.getByText('Is there a budget ring?')).toBeTruthy();
    expect(first.getByText('2 hours ago').getAttribute('datetime')).toBe(hoursAgo(2));
    expect(first.getByText('2 hours ago').getAttribute('title')).toMatch(/2026/);
    expect(card('FrostRunner').querySelector('img')!.getAttribute('src')).toBe(frost.avatarUrl);
    expect(card('FrostRunner').querySelector('img')!.getAttribute('alt')).toBe('');
  });

  it('marks the build author in words, not only by color', () => {
    renderPanel(readySeed([rawComment({ id: 'r1', author }), rawComment({ id: 'r2', author: { id: 'acc-x', name: 'MisoxShiru fan' } })]));

    expect(within(card('MisoxShiru')).getByText('Build author')).toBeTruthy();
    expect(within(card('MisoxShiru fan')).queryByText('Build author')).toBeNull();
  });

  it('shows initials when a commenter has no avatar', () => {
    renderPanel(readySeed([rawComment({ id: 'r1', author: ashen })]));

    expect(within(card('AshenExile')).getByText('A', { selector: '.comment__avatar' })).toBeTruthy();
  });

  it('keeps a deleted comment as a placeholder with its replies', () => {
    renderPanel(readySeed([deletedComment({ id: 'd1', replyCount: 1 }), rawComment({ id: 'a1', parentId: 'd1', author: ashen })]));

    expect(screen.getByText('Comment unavailable')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View 1 reply' })).toBeTruthy();
  });

  it('offers no replies on a comment that has none', () => {
    renderPanel(readySeed([deletedComment({ id: 'd1' }), rawComment({ id: 'r1', author: frost })]));

    expect(screen.queryByRole('button', { name: /repl/ })).toBeNull();
  });

  it('hides a spoiler until the reader asks for it', () => {
    renderPanel(readySeed([rawComment({ id: 'r1', author: frost, text: 'The boss dies at 50%.', isSpoiler: true, spoilerLabel: 'Boss fight' })]));

    expect(screen.queryByText('The boss dies at 50%.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show spoiler: Boss fight' }));
    expect(screen.getByText('The boss dies at 50%.')).toBeTruthy();
  });

  it('falls back to the plain text when the rich body is missing', () => {
    renderPanel(readySeed([rawComment({ id: 'r1', author: frost, content: null, text: 'Only plain' })]));

    expect(screen.getByText('Only plain')).toBeTruthy();
  });

  describe('replies', () => {
    const thread = () =>
      readySeed([
        rawComment({ id: 'r1', author: frost, replyCount: 2, text: 'Budget ring?' }),
        rawComment({ id: 'a1', parentId: 'r1', author, text: 'Start with a rare.', createdAt: hoursAgo(1) }),
        rawComment({ id: 'a2', parentId: 'r1', author: frost, text: 'Thanks!', createdAt: hoursAgo(0.5) }),
      ]);

    it('are folded under their comment until opened, oldest first', () => {
      renderPanel(thread());

      const toggle = screen.getByRole('button', { name: 'View 2 replies' });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByText('Start with a rare.')).toBeNull();

      fireEvent.click(toggle);

      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(toggle.textContent).toContain('Hide replies');
      const region = document.getElementById(toggle.getAttribute('aria-controls')!)!;
      expect(within(region).getAllByText(/Start with a rare\.|Thanks!/).map((el) => el.textContent)).toEqual(['Start with a rare.', 'Thanks!']);
    });

    it("say when the build author answered in the thread", () => {
      renderPanel(thread());

      expect(within(card('FrostRunner')).getByText('Author replied')).toBeTruthy();
    });

    it('load the ones the page did not include when opened, and only once', async () => {
      const { calls, settle } = renderPanel(
        readySeed([rawComment({ id: 'r1', author: frost, replyCount: 3 }), rawComment({ id: 'a1', parentId: 'r1', author: ashen, text: 'First', createdAt: hoursAgo(3) })]),
      );

      fireEvent.click(screen.getByRole('button', { name: 'View 3 replies' }));
      expect(screen.getByText('First')).toBeTruthy();
      expect(calls).toEqual([expect.objectContaining({ kind: 'replies', input: expect.objectContaining({ parentId: 'r1' }) })]);
      expect(screen.getByText('Loading replies…')).toBeTruthy();

      await settle(0, ok([rawComment({ id: 'a2', parentId: 'r1', author: ashen, text: 'Second', createdAt: hoursAgo(2) })], { parentId: 'r1', hasMore: true, cursor: 'r-2' }));
      expect(screen.getByText('Second')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Load more replies' }));
      await settle(1, ok([rawComment({ id: 'a3', parentId: 'r1', author: ashen, text: 'Third', createdAt: hoursAgo(1) })], { parentId: 'r1' }));

      expect(screen.getByText('Third')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Load more replies' })).toBeNull();
      expect(calls).toHaveLength(2);
    });

    it('show a failed load inside the thread with a way to try again', async () => {
      const { calls, settle } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost, replyCount: 1 })]));

      fireEvent.click(screen.getByRole('button', { name: 'View 1 reply' }));
      await settle(0, { ok: false, error: { message: 'HTTP 500', retryAfterSeconds: null } });

      expect(screen.getByText("Couldn't load replies (HTTP 500).")).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(calls).toHaveLength(2);
    });

    it('show answers to a reply at the same depth, saying whom they answer', async () => {
      const { calls, settle } = renderPanel(
        readySeed([rawComment({ id: 'r1', author: frost, replyCount: 1 }), rawComment({ id: 'a1', parentId: 'r1', author, replyCount: 1, text: 'Use a rare.' })]),
      );

      fireEvent.click(screen.getByRole('button', { name: 'View 1 reply' }));
      fireEvent.click(within(card('MisoxShiru')).getByRole('button', { name: 'View 1 reply' }));
      expect(calls[0]).toMatchObject({ kind: 'replies', input: { parentId: 'a1' } });

      await settle(0, ok([rawComment({ id: 'x1', parentId: 'a1', depth: 2, author: ashen, text: 'Which rare?' })], { parentId: 'a1' }));

      const answer = card('AshenExile');
      expect(within(answer).getByText('Which rare?')).toBeTruthy();
      expect(within(answer).getByText('Replying to @MisoxShiru')).toBeTruthy();
      expect(answer.parentElement).toBe(card('MisoxShiru').parentElement);
    });
  });

  describe('more comments', () => {
    it('loads the next page on request and stops offering it at the end', async () => {
      const { calls, settle } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost })], { hasMore: true, cursor: 'c2' }));

      fireEvent.click(screen.getByRole('button', { name: 'Load more comments' }));
      expect(calls[0]).toMatchObject({ kind: 'roots', input: { cursor: 'c2' } });
      expect((screen.getByRole('button', { name: 'Loading…' }) as HTMLButtonElement).disabled).toBe(true);

      await settle(0, ok([rawComment({ id: 'r2', author: ashen })]));

      expect(card('AshenExile')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Load more comments|Loading/ })).toBeNull();
    });

    it('keeps the comments read so far when a page fails', async () => {
      const { calls, settle } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost })], { hasMore: true }));

      fireEvent.click(screen.getByRole('button', { name: 'Load more comments' }));
      await settle(0, { ok: false, error: { message: 'HTTP 503', retryAfterSeconds: null } });

      expect(screen.getByRole('alert').textContent).toContain("Couldn't load more comments (HTTP 503).");
      expect(card('FrostRunner')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Load more comments' }));
      expect(calls).toHaveLength(2);
    });

    it('says when the site asked to wait before trying again', async () => {
      const { settle } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost })], { hasMore: true }));

      fireEvent.click(screen.getByRole('button', { name: 'Load more comments' }));
      await settle(0, { ok: false, error: { message: 'RATE_LIMITED', retryAfterSeconds: 30 } });

      expect(screen.getByRole('alert').textContent).toContain('The site asked to wait 30 s.');
    });
  });

  describe('states', () => {
    it('says when there are no comments yet', () => {
      renderPanel(readySeed([], {}, 0));
      expect(screen.getByText('No comments yet')).toBeTruthy();
    });

    it('says when the author turned comments off', () => {
      renderPanel({ status: 'disabled' });
      expect(screen.getByText('Comments are disabled for this build')).toBeTruthy();
    });

    it('offers to load the discussion when the page did not carry it, and reports why it failed', async () => {
      const { calls, settle } = renderPanel({ status: 'unavailable', resourceId: resourceIdOf('doc-1'), authorId: AUTHOR_ID, total: 3 });

      expect(screen.getByText('Comments are unavailable here')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(screen.getByRole('status').textContent).toContain('Loading comments…');

      await settle(0, { ok: false, error: { message: 'HTTP 403', retryAfterSeconds: null } });
      expect(screen.getByText("Couldn't load comments (HTTP 403).")).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await settle(1, ok([rawComment({ id: 'r1', author: frost })]));
      expect(card('FrostRunner')).toBeTruthy();
    });

    it('offers nothing to retry when the page has no comments section at all', () => {
      renderPanel({ status: 'unavailable', resourceId: null, authorId: null, total: null });

      expect(screen.getByText('Comments are unavailable here')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    });
  });
});
