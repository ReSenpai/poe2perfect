import type { RawBuildDocument } from '@/lib/data/types';
import { safeHttpsUrl } from '@/lib/rich-text/convert';
import { COMMENT_SORTS, type Comment, type CommentsList, type CommentsSeed, type CommentsSort } from './model';

const COMMENTS_WIDGET = 'NgfDocumentCmWidgetCommentsV1';

type Obj = Record<string, unknown>;

const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown) => (typeof value === 'string' && value.length > 0 ? value : null);
const count = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);
const asSort = (value: unknown): CommentsSort | null => (COMMENT_SORTS as readonly unknown[]).includes(value) ? (value as CommentsSort) : null;

/** The discussion as the build page ships it: the comments widget's first page and the guide's counter. */
export function parseCommentsSeed(doc: RawBuildDocument): CommentsSeed {
  const widget = doc.content.find((w) => w.__typename === COMMENTS_WIDGET);
  if (!widget) return { status: 'unavailable' };
  if (widget.data.isDisabled === true) return { status: 'disabled' };

  const authorId = isObj(doc.author) ? str(doc.author.id) : null;
  const list = parseCommentsPayload(widget.data.payload, authorId);
  if (!list) return { status: 'unavailable' };

  const payload = widget.data.payload as Obj;
  const data = payload.data as Obj;
  const sorting = isObj(widget.data.commentsUiCapabilities) ? widget.data.commentsUiCapabilities.sorting : null;
  const stats = isObj(doc.comments) && isObj(doc.comments.stats) ? doc.comments.stats : null;
  return {
    status: 'ready',
    resourceId: str(payload.resourceId) ?? `Poe2:UG:${doc.id}`,
    sort: asSort(data.sortBy) ?? 'NEW',
    canSort: !isObj(sorting) || sorting.enabled !== false,
    total: stats ? count(stats.totalComments) : null,
    list,
  };
}

/**
 * One `CommentsPayload` (the seed, or a page of the list or replies query) as a comment list; null when it holds
 * no list, e.g. the site answered with an error. `authorId` is the guide author's account id.
 */
export function parseCommentsPayload(payload: unknown, authorId: string | null): CommentsList | null {
  if (!isObj(payload) || payload.error || !isObj(payload.data) || !Array.isArray(payload.data.comments)) return null;

  const comments: Record<string, Comment> = {};
  const order: string[] = [];
  for (const raw of payload.data.comments) {
    const comment = parseComment(raw, authorId);
    if (!comment) continue;
    if (!(comment.id in comments)) order.push(comment.id);
    comments[comment.id] = comment;
  }

  const rootIds: string[] = [];
  const replies: Record<string, string[]> = {};
  for (const id of order) {
    const { parentId } = comments[id]!;
    if (parentId === null) rootIds.push(id);
    else (replies[parentId] ??= []).push(id);
  }
  for (const ids of Object.values(replies)) ids.sort((a, b) => compareOldestFirst(comments[a]!, comments[b]!));

  const page = isObj(payload.page) ? payload.page : {};
  const hasMore = page.hasMoreItems === true && str(page.nextCursor) !== null;
  return { comments, rootIds, replies, page: { hasMore, cursor: hasMore ? str(page.nextCursor) : null } };
}

/** Dated replies by date; undated ones keep their place after them (`sort` is stable). */
function compareOldestFirst(a: Comment, b: Comment): number {
  if (a.createdAt === null || b.createdAt === null) return (a.createdAt === null ? 1 : 0) - (b.createdAt === null ? 1 : 0);
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

function parseComment(raw: unknown, authorId: string | null): Comment | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const parentId = str(raw.parentId);
  const deleted = raw.status === 'DELETED';
  const createdAt = str(raw.createdAt);

  return {
    id,
    parentId,
    depth: count(raw.depth) ?? (parentId ? 1 : 0),
    author: deleted ? null : parseAuthor(raw, authorId),
    body: !deleted && isObj(raw.content) && isObj(raw.content.root) ? { root: raw.content.root } : null,
    plainText: deleted ? '' : (str(raw.plainTextContent) ?? ''),
    createdAt: createdAt && !Number.isNaN(Date.parse(createdAt)) ? createdAt : null,
    deleted,
    spoiler: raw.isSpoiler === true ? (str(raw.spoilerLabel) ?? 'Spoiler') : null,
    replyCount: count(raw.replyCount) ?? 0,
  };
}

function parseAuthor(raw: Obj, authorId: string | null): Comment['author'] {
  const profile = isObj(raw.profile) ? raw.profile : {};
  const user = isObj(profile.user) ? profile.user : {};
  const avatar = isObj(profile.avatar) ? profile.avatar : {};
  const id = str(raw.accountId) ?? str(user.id) ?? '';
  return {
    id,
    name: str(user.displayName) ?? str(user.username) ?? 'Unknown user',
    avatarUrl: safeHttpsUrl(avatar.iconUrl),
    isBuildAuthor: authorId !== null && id === authorId,
  };
}
