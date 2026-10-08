import { useEffect, useState } from 'preact/hooks';
import type { CommentsController, CommentsState } from '@/lib/comments/controller';

/** What a build without a discussion to read shows. */
const NO_DISCUSSION: CommentsState = { status: 'unavailable', canRetry: false, total: null, load: { status: 'idle' } };

/** The controller's current state, re-rendering on every change. */
export function useCommentsState(controller: CommentsController | null): CommentsState {
  const [state, setState] = useState(() => controller?.getState() ?? NO_DISCUSSION);

  useEffect(() => {
    if (!controller) {
      setState(NO_DISCUSSION);
      return undefined;
    }
    setState(controller.getState());
    return controller.subscribe(setState);
  }, [controller]);

  return state;
}
