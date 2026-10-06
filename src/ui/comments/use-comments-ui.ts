import { useState } from 'preact/hooks';
import type { CommentsSort } from '@/lib/comments/model';

/**
 * How the reader has set up the discussion: search, filter, folded threads, the open reply box, the order asked for.
 * Held above the panel so the Comments tab and the side panel show the same reading, whichever is in front.
 */
export interface CommentsUi {
  query: string;
  setQuery: (query: string) => void;
  authorOnly: boolean;
  setAuthorOnly: (authorOnly: boolean) => void;
  /** Threads the reader opened or folded against the default; the rest follow their depth. */
  toggled: ReadonlyMap<string, boolean>;
  setToggled: (update: (current: ReadonlyMap<string, boolean>) => ReadonlyMap<string, boolean>) => void;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  /** The order asked for, shown while its first page loads. */
  wantedSort: CommentsSort | null;
  setWantedSort: (sort: CommentsSort | null) => void;
}

export function useCommentsUi(): CommentsUi {
  const [query, setQuery] = useState('');
  const [authorOnly, setAuthorOnly] = useState(false);
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [wantedSort, setWantedSort] = useState<CommentsSort | null>(null);
  return { query, setQuery, authorOnly, setAuthorOnly, toggled, setToggled, replyingTo, setReplyingTo, wantedSort, setWantedSort };
}
