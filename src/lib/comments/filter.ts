import type { CommentsList } from './model';

export interface ThreadFilter {
  /** Words to look for in the loaded comments' text and author names. */
  query: string;
  /** Only threads the build author answered in. */
  authorReplied: boolean;
}

export interface FilteredThreads {
  /** Root comments of the threads to show, in the list's order. */
  rootIds: string[];
  /** Comments that contain the query. */
  matches: Set<string>;
  /** Comments whose answers must be open so that every match shows. */
  reveal: Set<string>;
}

/** The threads of the loaded list that fit the filter. Searches loaded comments only; the caller says so. */
export function filterThreads(list: CommentsList, { query, authorReplied }: ThreadFilter): FilteredThreads {
  const needle = query.trim().toLowerCase();
  const matches = new Set<string>();
  const reveal = new Set<string>();
  const descendants = (id: string): string[] => (list.replies[id] ?? []).flatMap((child) => [child, ...descendants(child)]);

  const isMatch = (id: string) => {
    const comment = list.comments[id];
    if (!comment || comment.deleted || !needle) return false;
    return comment.plainText.toLowerCase().includes(needle) || (comment.author?.name.toLowerCase().includes(needle) ?? false);
  };

  const rootIds = list.rootIds.filter((rootId) => {
    const below = descendants(rootId);
    if (authorReplied && !below.some((id) => list.comments[id]?.author?.isBuildAuthor)) return false;
    if (!needle) return true;

    const found = [rootId, ...below].filter(isMatch);
    found.forEach((id) => {
      matches.add(id);
      for (let parent = list.comments[id]?.parentId; parent; parent = list.comments[parent]?.parentId ?? null) reveal.add(parent);
    });
    return found.length > 0;
  });

  return { rootIds, matches, reveal };
}
