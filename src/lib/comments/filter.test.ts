import { describe, expect, it } from 'vitest';
import { AUTHOR_ID, commentsPayload, deletedComment, rawComment } from '../../../tests/fixtures/comments';
import { filterThreads } from './filter';
import { parseCommentsPayload } from './parse-comments';

const author = { id: AUTHOR_ID, name: 'Misox' };
const frost = { id: 'acc-frost', name: 'FrostRunner' };
const ashen = { id: 'acc-ashen', name: 'AshenExile' };

const list = parseCommentsPayload(
  commentsPayload({
    comments: [
      rawComment({ id: 'r1', author: frost, text: 'Budget ring for maps?' }),
      rawComment({ id: 'a1', parentId: 'r1', author, text: 'Start with a rare one.' }),
      rawComment({ id: 'b1', parentId: 'a1', depth: 2, author: ashen, text: 'Which Rare base?' }),
      rawComment({ id: 'r2', author: ashen, text: 'Great guide' }),
      rawComment({ id: 'a2', parentId: 'r2', author: frost, text: 'Agreed' }),
      deletedComment({ id: 'd1' }),
      rawComment({ id: 'x1', parentId: 'd1', author: ashen, text: 'The deleted one asked about rings' }),
    ],
  }),
  AUTHOR_ID,
)!;

describe('filterThreads', () => {
  it('keeps every thread in order when nothing is asked for', () => {
    expect(filterThreads(list, { query: '', authorReplied: false })).toEqual({ rootIds: ['r1', 'r2', 'd1'], matches: new Set(), reveal: new Set() });
  });

  it("finds words in any comment's text or author name, ignoring case and spaces around the query", () => {
    const result = filterThreads(list, { query: '  RARE ', authorReplied: false });

    expect(result.rootIds).toEqual(['r1']);
    expect(result.matches).toEqual(new Set(['a1', 'b1']));
  });

  it('opens the way down to an answer that matches, keeping its parents for context', () => {
    const result = filterThreads(list, { query: 'which', authorReplied: false });

    expect(result.rootIds).toEqual(['r1']);
    expect(result.reveal).toEqual(new Set(['r1', 'a1']));
  });

  it('matches by author name', () => {
    expect(filterThreads(list, { query: 'frostrunner', authorReplied: false })).toMatchObject({ rootIds: ['r1', 'r2'], matches: new Set(['r1', 'a2']) });
  });

  it('never matches the missing text of a deleted comment, but finds its answers', () => {
    expect(filterThreads(list, { query: 'rings', authorReplied: false })).toMatchObject({ rootIds: ['d1'], matches: new Set(['x1']) });
  });

  it('keeps whole threads the build author answered in', () => {
    expect(filterThreads(list, { query: '', authorReplied: true }).rootIds).toEqual(['r1']);
  });

  it('combines the filter with a query', () => {
    expect(filterThreads(list, { query: 'great', authorReplied: true }).rootIds).toEqual([]);
    expect(filterThreads(list, { query: 'which', authorReplied: true }).rootIds).toEqual(['r1']);
  });
});
