/** Normalized build discussion, independent of mobalytics' comment payloads. Belongs to the whole guide, not a variant. */

import type { RichText } from '@/lib/build/model';

/** Orders the site's comment API accepts (`CommentsSortBy`). */
export const COMMENT_SORTS = ['NEW', 'OLD', 'TOP'] as const;
export type CommentsSort = (typeof COMMENT_SORTS)[number];

/** A reader's vote on a comment. */
export type Vote = 'up' | 'down';

export interface CommentAuthor {
  /** Account id; empty when the site leaves it out. */
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Matched by account id against the guide author, never by name. */
  isBuildAuthor: boolean;
}

export interface Comment {
  id: string;
  parentId: string | null;
  /** 0 for a root comment, 1 for a reply to it, 2 for a reply to a reply. */
  depth: number;
  /** Null for a deleted comment. */
  author: CommentAuthor | null;
  /** Lexical body; null when missing — `plainText` is the fallback. */
  body: RichText | null;
  plainText: string;
  /** ISO date; null when the site's value is unreadable. The site has no "edited" date (`updatedAt` moves on votes). */
  createdAt: string | null;
  /** Who deleted it, if anyone. The site drops the text and the author but keeps the comment for its replies. */
  deleted: 'author' | 'moderator' | null;
  /** Label to show instead of the text until the reader asks for it; null when it is not a spoiler. */
  spoiler: string | null;
  replyCount: number;
  /** Upvotes minus downvotes. */
  score: number;
  /** The reader's own vote, as far as the site said (the build page itself is read signed out, so it never says). */
  viewerVote: Vote | null;
}

export interface CommentsPage {
  hasMore: boolean;
  cursor: string | null;
}

/** One or more pages of comments merged together. */
export interface CommentsList {
  comments: Record<string, Comment>;
  /** Root comments in the order the site sent them. */
  rootIds: string[];
  /** Loaded replies by parent id, oldest first. */
  replies: Record<string, string[]>;
  /** Continuation of the root list. */
  page: CommentsPage;
}

/** What the build page itself says about its discussion; further pages come from the site's API. */
export type CommentsSeed =
  | {
      status: 'unavailable';
      /** Set when the page has a comments section whose list just didn't come through: the API can still load it. */
      resourceId: string | null;
      authorId: string | null;
      total: number | null;
    }
  | { status: 'disabled' }
  | {
      status: 'ready';
      /** `Poe2:UG:<document id>`, the key of the site's comment API. */
      resourceId: string;
      /** The guide author's account id, to recognise their comments on later pages. */
      authorId: string | null;
      sort: CommentsSort;
      canSort: boolean;
      /** The counter the site shows on the guide (messages of all levels); null when the page has none. */
      total: number | null;
      list: CommentsList;
    };
