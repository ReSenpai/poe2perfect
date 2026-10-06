import { act, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTHOR_ID, commentsPayload, deletedComment, rawComment, resourceIdOf } from '../../../tests/fixtures/comments';
import { createCommentsController } from '@/lib/comments/controller';
import type { CommentsSeed } from '@/lib/comments/model';
import { parseCommentsPayload } from '@/lib/comments/parse-comments';
import type { CommentsSource, SourceResult } from '@/lib/comments/source';
import { CommentsPanel } from './CommentsPanel';

const NOW = Date.parse('2026-10-06T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

type Pending = { kind: 'roots' | 'replies' | 'post' | 'vote'; input: Record<string, unknown>; resolve: (result: SourceResult) => void };

function fakeSource() {
  const calls: Pending[] = [];
  const ask = (kind: Pending['kind']) => (input: object) =>
    new Promise<SourceResult>((resolve) => calls.push({ kind, input: input as Record<string, unknown>, resolve }));
  const source: CommentsSource = { roots: ask('roots'), replies: ask('replies'), post: ask('post'), vote: ask('vote') };
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

function renderPanel(seed: CommentsSeed, onOpenOriginal?: () => void) {
  const { source, calls } = fakeSource();
  const controller = createCommentsController({ seed, source, now: () => NOW });
  const view = render(<CommentsPanel controller={controller} now={() => NOW} onOpenOriginal={onOpenOriginal} />);
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

/** IntersectionObserver stand-in: `reachEnd()` reports the end of the list as visible. */
const observers: { callback: IntersectionObserverCallback; active: boolean }[] = [];
class FakeObserver {
  private readonly entry: { callback: IntersectionObserverCallback; active: boolean };
  constructor(callback: IntersectionObserverCallback) {
    this.entry = { callback, active: true };
    observers.push(this.entry);
  }
  observe() {}
  disconnect() {
    this.entry.active = false;
  }
}
const reachEnd = () =>
  act(() => {
    for (const { callback, active } of [...observers]) if (active) callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  });

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const card = (name: string) => screen.getByText(name, { selector: '.comment__name' }).closest('article')!;

describe('CommentsPanel', () => {
  it('leaves the name and the counter to the tab, and scrolls its bar away with the comments', () => {
    const { container } = renderPanel(readySeed([rawComment({ id: 'r1' })]));

    expect(screen.queryByRole('heading', { name: /Comments/ })).toBeNull();
    const list = container.querySelector('.comments__list')!;
    expect(list.querySelector('header')).toBeTruthy();
    expect(within(list as HTMLElement).getByRole('searchbox', { name: 'Search comments' })).toBeTruthy();
    expect(within(list as HTMLElement).getByRole('textbox', { name: 'Add a comment' })).toBeTruthy();
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

  it('keeps a deleted comment that has answers as a placeholder, as the site does', () => {
    renderPanel(readySeed([deletedComment({ id: 'd1', replyCount: 1 }), rawComment({ id: 'a1', parentId: 'd1', author: ashen, text: 'Still here' })]));

    expect(screen.getByText('This comment was deleted by its author.')).toBeTruthy();
    expect(screen.getByText('Still here')).toBeTruthy();
  });

  it('says when a moderator removed a comment', () => {
    renderPanel(readySeed([deletedComment({ id: 'm1', replyCount: 1, deletedByModerator: true }), rawComment({ id: 'a1', parentId: 'm1', author: ashen })]));

    expect(screen.getByText('This comment was removed by a moderator.')).toBeTruthy();
  });

  it('leaves out deleted comments nobody answered, as the site does', () => {
    const { container } = renderPanel(
      readySeed([
        deletedComment({ id: 'd1' }),
        rawComment({ id: 'r1', author: frost, replyCount: 1 }),
        deletedComment({ id: 'd2', parentId: 'r1', depth: 1 }),
      ]),
    );

    expect(screen.queryByText(/was deleted/)).toBeNull();
    expect(container.querySelectorAll('article')).toHaveLength(1);
  });

  it('offers no replies on a comment that has none', () => {
    renderPanel(readySeed([deletedComment({ id: 'd1' }), rawComment({ id: 'r1', author: frost })]));

    expect(screen.queryByRole('button', { name: /View|Hide replies/ })).toBeNull();
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

    it('are open from the start, oldest first, and can be folded away', () => {
      renderPanel(thread());

      const toggle = screen.getByRole('button', { name: 'Hide replies' });
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      const region = document.getElementById(toggle.getAttribute('aria-controls')!)!;
      expect(within(region).getAllByText(/Start with a rare\.|Thanks!/).map((el) => el.textContent)).toEqual(['Start with a rare.', 'Thanks!']);

      fireEvent.click(toggle);

      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(toggle.getAttribute('aria-label')).toBe('View 2 replies');
      expect(toggle.textContent).toBe('');
      expect(screen.queryByText('Start with a rare.')).toBeNull();
    });

    it('fold from their line too, as on Reddit', () => {
      const { container } = renderPanel(thread());

      fireEvent.click(container.querySelector('.thread__rail')!);

      expect(screen.queryByText('Start with a rare.')).toBeNull();
      expect(screen.getByRole('button', { name: 'View 2 replies' })).toBeTruthy();
    });

    it("say when the build author answered in the thread", () => {
      renderPanel(thread());

      const root = screen.getAllByText('FrostRunner', { selector: '.comment__name' })[0]!.closest('article')!;
      expect(within(root).getByText('Author replied')).toBeTruthy();
    });

    it('load the ones the page did not include by themselves, and only once', async () => {
      const { calls, settle } = renderPanel(
        readySeed([rawComment({ id: 'r1', author: frost, replyCount: 3 }), rawComment({ id: 'a1', parentId: 'r1', author: ashen, text: 'First', createdAt: hoursAgo(3) })]),
      );

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

      await settle(0, { ok: false, error: { message: 'HTTP 500', retryAfterSeconds: null } });

      expect(screen.getByText("Couldn't load replies (HTTP 500).")).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(calls).toHaveLength(2);
    });

    it('nest answers to a reply under it, like a thread', async () => {
      const { calls, settle } = renderPanel(
        readySeed([rawComment({ id: 'r1', author: frost, replyCount: 1 }), rawComment({ id: 'a1', parentId: 'r1', author, replyCount: 1, text: 'Use a rare.' })]),
      );

      expect(calls[0]).toMatchObject({ kind: 'replies', input: { parentId: 'a1' } });

      await settle(0, ok([rawComment({ id: 'x1', parentId: 'a1', depth: 2, author: ashen, text: 'Which rare?' })], { parentId: 'a1' }));

      const answer = card('AshenExile');
      expect(within(answer).getByText('Which rare?')).toBeTruthy();
      expect(card('MisoxShiru').contains(answer)).toBe(true);
      expect(screen.queryByText(/Replying to/)).toBeNull();
    });
  });

  describe('deep threads', () => {
    it('open by themselves down to the third level of answers and fold deeper ones', async () => {
      const { calls, settle } = renderPanel(
        readySeed([
          rawComment({ id: 'r1', author: frost, replyCount: 1 }),
          rawComment({ id: 'a1', parentId: 'r1', author: ashen, replyCount: 1, text: 'Level one' }),
        ]),
      );

      await settle(0, ok([rawComment({ id: 'b1', parentId: 'a1', depth: 2, author: frost, replyCount: 1, text: 'Level two' })], { parentId: 'a1' }));
      expect(calls[1]).toMatchObject({ input: { parentId: 'b1' } });
      await settle(1, ok([rawComment({ id: 'c1', parentId: 'b1', depth: 3, author: ashen, replyCount: 2, text: 'Level three' })], { parentId: 'b1' }));

      expect(screen.getByText('Level three')).toBeTruthy();
      expect(calls).toHaveLength(2);
      const deeper = within(screen.getByText('Level three').closest('article')!).getByRole('button', { name: 'View 2 replies' });
      expect(deeper.getAttribute('aria-expanded')).toBe('false');

      fireEvent.click(deeper);
      expect(calls[2]).toMatchObject({ input: { parentId: 'c1' } });
      expect(deeper.getAttribute('aria-label')).toBe('Hide replies');
    });

    it('give every open thread its own fold, so a branch folds alone', async () => {
      const { settle } = renderPanel(
        readySeed([rawComment({ id: 'r1', author: frost, replyCount: 1 }), rawComment({ id: 'a1', parentId: 'r1', author: ashen, replyCount: 1 })]),
      );
      await settle(0, ok([rawComment({ id: 'b1', parentId: 'a1', depth: 2, author: frost, text: 'Level two' })], { parentId: 'a1' }));

      const folds = screen.getAllByRole('button', { name: 'Hide replies' });
      expect(folds).toHaveLength(2);
      fireEvent.click(folds[1]!);

      expect(screen.queryByText('Level two')).toBeNull();
      expect(card('AshenExile')).toBeTruthy();
    });
  });

  describe('more comments', () => {
    it('load by themselves when the end of the list comes into view, until there are no more', async () => {
      const { calls, settle } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost })], { hasMore: true, cursor: 'c2' }));

      expect(screen.queryByRole('button', { name: /Load more/ })).toBeNull();
      await reachEnd();
      expect(calls[0]).toMatchObject({ kind: 'roots', input: { cursor: 'c2' } });
      expect(screen.getByRole('status').textContent).toContain('Loading more comments…');

      await reachEnd();
      expect(calls).toHaveLength(1);

      await settle(0, ok([rawComment({ id: 'r2', author: ashen })]));
      expect(card('AshenExile')).toBeTruthy();

      await reachEnd();
      expect(calls).toHaveLength(1);
    });

    it('keep the comments read so far when a page fails, and wait for the reader to try again', async () => {
      const { calls, settle } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost })], { hasMore: true }));

      await reachEnd();
      await settle(0, { ok: false, error: { message: 'HTTP 503', retryAfterSeconds: null } });

      expect(screen.getByRole('alert').textContent).toContain("Couldn't load more comments (HTTP 503).");
      expect(card('FrostRunner')).toBeTruthy();
      await reachEnd();
      expect(calls).toHaveLength(1);

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(calls).toHaveLength(2);
    });

    it('say when the site asked to wait before trying again', async () => {
      const { settle } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost })], { hasMore: true }));

      await reachEnd();
      await settle(0, { ok: false, error: { message: 'RATE_LIMITED', retryAfterSeconds: 30 } });

      expect(screen.getByRole('alert').textContent).toContain('The site asked to wait 30 s.');
    });
  });

  describe('sorting', () => {
    const sortButton = () => screen.getByRole('button', { name: /^Sort comments/ });

    it('picks the order from a menu in the guide\'s own style, loading the first page in it', async () => {
      const { calls, settle } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost })]));

      expect(sortButton().getAttribute('aria-label')).toBe('Sort comments: Newest');
      expect(sortButton().getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(sortButton());

      const menu = screen.getByRole('listbox', { name: 'Sort comments' });
      const options = within(menu).getAllByRole('option');
      expect(options.map((o) => o.textContent)).toEqual(['Newest', 'Oldest', 'Top']);
      expect(options.map((o) => o.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);

      fireEvent.click(options[1]!);

      expect(screen.queryByRole('listbox')).toBeNull();
      expect(calls[0]).toMatchObject({ kind: 'roots', input: { sort: 'OLD', cursor: null } });
      expect(sortButton().getAttribute('aria-label')).toBe('Sort comments: Oldest');

      await settle(0, ok([rawComment({ id: 'old', author: ashen })], { sortBy: 'OLD' }));
      expect(card('AshenExile')).toBeTruthy();
      expect(screen.queryByText('FrostRunner')).toBeNull();
    });

    it('works from the keyboard: arrows move, Enter picks, Escape closes', () => {
      const { calls } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost })]));

      fireEvent.keyDown(sortButton(), { key: 'ArrowDown' });
      const menu = screen.getByRole('listbox', { name: 'Sort comments' });
      expect(menu.getAttribute('aria-activedescendant')).toBe(within(menu).getAllByRole('option')[0]!.id);

      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      expect(menu.getAttribute('aria-activedescendant')).toBe(within(menu).getAllByRole('option')[2]!.id);
      fireEvent.keyDown(menu, { key: 'Enter' });
      expect(calls[0]).toMatchObject({ input: { sort: 'TOP' } });

      fireEvent.click(sortButton());
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(document.activeElement).toBe(sortButton());
    });

    it('goes back to the order shown when the new one fails', async () => {
      const { settle } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost })]));

      fireEvent.click(sortButton());
      fireEvent.click(screen.getByRole('option', { name: 'Top' }));
      await settle(0, { ok: false, error: { message: 'HTTP 502', retryAfterSeconds: null } });

      expect(screen.getByRole('alert').textContent).toBe("Couldn't sort the comments (HTTP 502).");
      expect(sortButton().getAttribute('aria-label')).toBe('Sort comments: Newest');
    });

    it('is not offered when the site does not sort this discussion', () => {
      renderPanel({ ...readySeed([rawComment({ id: 'r1' })]), canSort: false } as CommentsSeed);

      expect(screen.queryByRole('button', { name: /^Sort comments/ })).toBeNull();
    });
  });

  describe('search', () => {
    const discussion = (extra: Parameters<typeof commentsPayload>[0] = {}) =>
      readySeed(
        [
          rawComment({ id: 'r1', author: frost, text: 'Budget ring for maps?' }),
          rawComment({ id: 'a1', parentId: 'r1', author, text: 'Start with a rare ring.' }),
          rawComment({ id: 'r2', author: ashen, text: 'Which gem first?' }),
        ],
        extra,
      );
    const search = (text: string) => fireEvent.input(screen.getByRole('searchbox', { name: 'Search comments' }), { target: { value: text } });

    it('keeps only the threads that mention the words, answers included', () => {
      renderPanel(discussion());

      search('rare');

      expect(screen.getByText('Start with a rare ring.')).toBeTruthy();
      expect(screen.queryByText('Which gem first?')).toBeNull();
    });

    it('opens a folded thread to show the answer that matches', () => {
      renderPanel(discussion());
      fireEvent.click(screen.getByRole('button', { name: 'Hide replies' }));
      expect(screen.queryByText('Start with a rare ring.')).toBeNull();

      search('rare');

      expect(screen.getByText('Start with a rare ring.')).toBeTruthy();
    });

    it('says it only searched what is loaded and offers to load more instead of loading by itself', async () => {
      const { calls } = renderPanel(discussion({ hasMore: true }));

      search('gem');
      expect(screen.getByText(/Searching loaded comments only/)).toBeTruthy();
      await reachEnd();
      expect(calls).toHaveLength(0);

      fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
      expect(calls).toHaveLength(1);
    });

    it('says when nothing matches, with a way back to every comment', () => {
      renderPanel(discussion());

      search('flask');
      expect(screen.getByText('No matches in loaded comments')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
      expect(screen.getByText('Which gem first?')).toBeTruthy();
      expect((screen.getByRole('searchbox', { name: 'Search comments' }) as HTMLInputElement).value).toBe('');
    });
  });

  describe('Author replied', () => {
    it('keeps the threads the build author answered in', () => {
      renderPanel(
        readySeed([
          rawComment({ id: 'r1', author: frost, text: 'Budget ring?' }),
          rawComment({ id: 'a1', parentId: 'r1', author }),
          rawComment({ id: 'r2', author: ashen, text: 'Which gem first?' }),
        ]),
      );
      const all = screen.getByRole('button', { name: 'All comments' });
      const replied = screen.getByRole('button', { name: 'Author replied' });
      expect(all.getAttribute('aria-pressed')).toBe('true');

      fireEvent.click(replied);

      expect(replied.getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByText('Budget ring?')).toBeTruthy();
      expect(screen.queryByText('Which gem first?')).toBeNull();

      fireEvent.click(all);
      expect(screen.getByText('Which gem first?')).toBeTruthy();
    });

    it("finds the author's answers deeper in threads it is not showing, as new pages come", async () => {
      const { calls, settle } = renderPanel(
        readySeed([rawComment({ id: 'r1', author: frost, text: 'Budget ring?' }), rawComment({ id: 'a1', parentId: 'r1', author })], { hasMore: true }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Author replied' }));

      fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
      await settle(0, ok([rawComment({ id: 'r2', author: ashen, text: 'Which gem first?', replyCount: 1 }), rawComment({ id: 'a2', parentId: 'r2', author: frost, replyCount: 1 })]));
      expect(screen.queryByText('Which gem first?')).toBeNull();

      expect(calls[1]).toMatchObject({ kind: 'replies', input: { parentId: 'a2' } });
      await settle(1, ok([rawComment({ id: 'x1', parentId: 'a2', depth: 2, author, text: 'Gem answer' })], { parentId: 'a2' }));

      expect(screen.getByText('Which gem first?')).toBeTruthy();
      expect(screen.getByText('Gem answer')).toBeTruthy();
    });

    it('finds search words in answers the page left out too', async () => {
      const { calls, settle } = renderPanel(
        readySeed([rawComment({ id: 'r1', author: frost, text: 'Budget ring?' })], { hasMore: true }),
      );
      fireEvent.input(screen.getByRole('searchbox', { name: 'Search comments' }), { target: { value: 'flask' } });

      fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
      await settle(0, ok([rawComment({ id: 'r2', author: ashen, text: 'Which gem first?', replyCount: 1 }), rawComment({ id: 'a2', parentId: 'r2', author: frost, replyCount: 1 })]));
      expect(calls[1]).toMatchObject({ kind: 'replies', input: { parentId: 'a2' } });

      await settle(1, ok([rawComment({ id: 'x1', parentId: 'a2', depth: 2, author: ashen, text: 'Use a flask of mana' })], { parentId: 'a2' }));
      expect(screen.getByText('Which gem first?')).toBeTruthy();
    });

    it('is not offered when the build author cannot be told apart', () => {
      renderPanel({ ...readySeed([rawComment({ id: 'r1' })]), authorId: null } as CommentsSeed);

      expect(screen.queryByRole('button', { name: 'Author replied' })).toBeNull();
    });
  });

  describe('the original discussion', () => {
    it('opens the discussion on the site from a quiet button in the bar, leaving the list the whole height', () => {
      const open = vi.fn();
      const { container } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost })], { hasMore: true }), open);

      const header = container.querySelector('header')!;
      fireEvent.click(within(header).getByRole('button', { name: 'Open on Mobalytics' }));

      expect(open).toHaveBeenCalledOnce();
      expect(container.querySelector('footer')).toBeNull();
    });

    it('opens it too when the comments could not be read here', () => {
      const open = vi.fn();
      renderPanel({ status: 'unavailable', resourceId: null, authorId: null, total: null }, open);

      fireEvent.click(screen.getByRole('button', { name: 'Open on Mobalytics' }));
      expect(open).toHaveBeenCalledOnce();
    });

    it('offers nothing when the author turned comments off', () => {
      renderPanel({ status: 'disabled' }, vi.fn());

      expect(screen.queryByRole('button', { name: /Mobalytics/ })).toBeNull();
      expect(screen.queryByRole('textbox')).toBeNull();
    });
  });

  describe('votes', () => {
    const counts = (upvotes: number, downvotes: number): SourceResult => ({ ok: true, payload: { commentId: 'r1', upvotes, downvotes } });
    const votes = (name: string) => within(within(card(name)).getByRole('group', { name: 'Votes' }));

    it('show the score between up and down arrows', () => {
      renderPanel(readySeed([rawComment({ id: 'r1', author: frost, score: 5 })]));

      expect(votes('FrostRunner').getByText('5')).toBeTruthy();
      expect(votes('FrostRunner').getByRole('button', { name: 'Upvote' }).getAttribute('aria-pressed')).toBe('false');
      expect(votes('FrostRunner').getByRole('button', { name: 'Downvote' }).getAttribute('aria-pressed')).toBe('false');
    });

    it("vote once the site has answered, then settle on its counts; a second click takes the vote back", async () => {
      const { calls, settle } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost, score: 5 })]));

      fireEvent.click(votes('FrostRunner').getByRole('button', { name: 'Upvote' }));
      await settle(0, ok([rawComment({ id: 'r1', author: frost, score: 5 })]));
      expect(calls[1]).toMatchObject({ kind: 'vote', input: { commentId: 'r1', value: 'up' } });
      expect(votes('FrostRunner').getByText('5')).toBeTruthy();

      await settle(1, counts(9, 1));
      expect(votes('FrostRunner').getByText('8')).toBeTruthy();
      expect(votes('FrostRunner').getByRole('button', { name: 'Upvote' }).getAttribute('aria-pressed')).toBe('true');

      fireEvent.click(votes('FrostRunner').getByRole('button', { name: 'Upvote' }));
      expect(calls[2]).toMatchObject({ input: { commentId: 'r1', value: null } });
      expect(votes('FrostRunner').getByText('7')).toBeTruthy();
    });

    it('never flash a vote for a signed-out visitor, and ask to sign in', async () => {
      const open = vi.fn();
      const { settle } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost, score: 5 })]), open);

      fireEvent.click(votes('FrostRunner').getByRole('button', { name: 'Downvote' }));
      await settle(0, ok([rawComment({ id: 'r1', author: frost, score: 5 })]));
      expect(votes('FrostRunner').getByText('5')).toBeTruthy();
      await settle(1, { ok: false, error: { message: 'FORBIDDEN', retryAfterSeconds: null } });

      expect(votes('FrostRunner').getByText('5')).toBeTruthy();
      const alert = within(card('FrostRunner')).getByRole('alert');
      expect(alert.textContent).toContain('Sign in on Mobalytics to vote.');
      fireEvent.click(within(alert).getByRole('button', { name: 'Sign in on Mobalytics' }));
      expect(open).toHaveBeenCalledOnce();
    });

    it('are not offered on a deleted comment', () => {
      renderPanel(readySeed([deletedComment({ id: 'd1', replyCount: 1 }), rawComment({ id: 'a1', parentId: 'd1', author: ashen })]));

      expect(screen.getAllByRole('group', { name: 'Votes' })).toHaveLength(1);
    });
  });

  describe('writing', () => {
    const type = (box: HTMLElement, text: string) => fireEvent.input(box, { target: { value: text } });
    const created = (comment: ReturnType<typeof rawComment>): SourceResult => ({ ok: true, payload: { ...comment, rejectionReason: null } });

    it('posts a new comment from the box above the list and shows it first', async () => {
      const { calls, settle } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost })]));
      const box = screen.getByRole('textbox', { name: 'Add a comment' });

      type(box, 'Thanks for the guide!');
      fireEvent.click(screen.getByRole('button', { name: 'Post' }));

      expect(calls[0]).toMatchObject({ kind: 'post', input: { parentId: null, text: 'Thanks for the guide!' } });
      expect((screen.getByRole('button', { name: 'Posting…' }) as HTMLButtonElement).disabled).toBe(true);

      await settle(0, created(rawComment({ id: 'mine', author: ashen, text: 'Thanks for the guide!' })));

      expect((box as HTMLTextAreaElement).value).toBe('');
      expect(screen.getAllByText(/FrostRunner|AshenExile/, { selector: '.comment__name' }).map((el) => el.textContent)).toEqual(['AshenExile', 'FrostRunner']);
    });

    it('posts with Ctrl+Enter and never sends an empty box', () => {
      const { calls } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost })]));
      const box = screen.getByRole('textbox', { name: 'Add a comment' });

      expect((screen.getByRole('button', { name: 'Post' }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
      expect(calls).toHaveLength(0);

      type(box, 'Hello');
      fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
      expect(calls).toHaveLength(1);
    });

    it('keeps what was typed and asks to sign in on the site when the visitor is signed out', async () => {
      const open = vi.fn();
      const { settle } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost })]), open);
      const box = screen.getByRole('textbox', { name: 'Add a comment' });

      type(box, 'Hello');
      fireEvent.click(screen.getByRole('button', { name: 'Post' }));
      await settle(0, { ok: false, error: { message: 'FORBIDDEN', retryAfterSeconds: null } });

      expect((box as HTMLTextAreaElement).value).toBe('Hello');
      expect(screen.getByRole('alert').textContent).toContain('Sign in on Mobalytics to comment.');
      fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Sign in on Mobalytics' }));
      expect(open).toHaveBeenCalledOnce();
    });

    it("says why the site didn't take a comment", async () => {
      const { settle } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost })]));

      type(screen.getByRole('textbox', { name: 'Add a comment' }), 'Hello');
      fireEvent.click(screen.getByRole('button', { name: 'Post' }));
      await settle(0, { ok: false, error: { message: 'HTTP 500', retryAfterSeconds: null } });

      expect(screen.getByRole('alert').textContent).toBe("Couldn't post your comment (HTTP 500).");
    });

    it('answers a comment in a box right below it, then shows the answer in its thread', async () => {
      const { calls, settle } = renderPanel(readySeed([rawComment({ id: 'r1', author: frost, text: 'Budget ring?' })]));

      fireEvent.click(within(card('FrostRunner')).getByRole('button', { name: 'Reply' }));
      const box = screen.getByRole('textbox', { name: 'Reply to FrostRunner' });
      expect(document.activeElement).toBe(box);

      type(box, 'Start with a rare.');
      fireEvent.click(within(card('FrostRunner')).getByRole('button', { name: 'Send reply' }));
      expect(calls[0]).toMatchObject({ kind: 'post', input: { parentId: 'r1', text: 'Start with a rare.' } });
      await settle(0, created(rawComment({ id: 'mine', parentId: 'r1', author: ashen, text: 'Start with a rare.' })));

      expect(screen.queryByRole('textbox', { name: 'Reply to FrostRunner' })).toBeNull();
      expect(screen.getByText('Start with a rare.')).toBeTruthy();
    });

    it('closes the reply box on Cancel or Escape', () => {
      renderPanel(readySeed([rawComment({ id: 'r1', author: frost })]));

      fireEvent.click(within(card('FrostRunner')).getByRole('button', { name: 'Reply' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('textbox', { name: 'Reply to FrostRunner' })).toBeNull();

      fireEvent.click(within(card('FrostRunner')).getByRole('button', { name: 'Reply' }));
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Reply to FrostRunner' }), { key: 'Escape' });
      expect(screen.queryByRole('textbox', { name: 'Reply to FrostRunner' })).toBeNull();
    });

    it('offers no reply to a deleted comment', () => {
      renderPanel(readySeed([deletedComment({ id: 'd1', replyCount: 1 }), rawComment({ id: 'a1', parentId: 'd1', author: ashen })]));

      const replies = screen.getAllByRole('button', { name: 'Reply' });
      expect(replies).toHaveLength(1);
      expect(replies[0]!.closest('article')).toBe(card('AshenExile'));
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
