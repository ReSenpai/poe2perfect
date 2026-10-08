import { createCommentsController, hasMissingReplies, type CommentsController, type CommentsState, type LoadState } from '@/lib/comments/controller';
import type { CommentsSeed } from '@/lib/comments/model';
import type { CommentsSource } from '@/lib/comments/source';

const WAIT_MS = 15_000;

type Ready = Extract<CommentsState, { status: 'ready' }>;

/**
 * Dev check of the comment API from the content script: one more page of roots and one missing thread, loaded through
 * the real controller and source. The report holds counts and statuses only — no names or texts.
 */
export async function probeComments(seed: CommentsSeed, source: CommentsSource): Promise<Record<string, unknown>> {
  if (seed.status !== 'ready') return { seed: seed.status };
  const controller = createCommentsController({ seed, source });
  const ready = () => controller.getState() as Ready;
  const report: Record<string, unknown> = {
    seed: 'ready',
    total: seed.total,
    seedRoots: seed.list.rootIds.length,
    seedMessages: Object.keys(seed.list.comments).length,
  };

  try {
    if (seed.list.page.hasMore) {
      controller.loadMore();
      const more = await settled(controller, () => ready().more);
      report.afterMore = { ...describe(more), roots: ready().list.rootIds.length, hasMore: ready().list.page.hasMore };
    }

    const { list } = ready();
    const parentId = [...list.rootIds, ...Object.values(list.replies).flat()].find((id) => hasMissingReplies(ready(), id));
    if (parentId) {
      controller.loadReplies(parentId);
      const load = await settled(controller, () => ready().replies[parentId]!.load);
      report.afterReplies = { ...describe(load), depth: list.comments[parentId]!.depth, loaded: ready().list.replies[parentId]?.length ?? 0 };
    }

    report.byAuthor = Object.values(ready().list.comments).filter((comment) => comment.author?.isBuildAuthor).length;
    return report;
  } finally {
    controller.dispose();
  }
}

function describe(load: LoadState) {
  return load.status === 'error' ? { status: 'error', message: load.message } : { status: load.status };
}

/** Resolves with `read()` once it stops loading. */
function settled(controller: CommentsController, read: () => LoadState): Promise<LoadState> {
  return new Promise((resolve, reject) => {
    const check = () => {
      const load = read();
      if (load.status === 'loading') return false;
      unsubscribe();
      clearTimeout(timer);
      resolve(load);
      return true;
    };
    const unsubscribe = controller.subscribe(() => void check());
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('timed out'));
    }, WAIT_MS);
    check();
  });
}
