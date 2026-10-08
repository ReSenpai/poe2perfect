import { describe, expect, it, vi } from 'vitest';
import type { Build } from '@/lib/build/model';
import type { CommentsController } from '@/lib/comments/controller';
import type { CommentsSeed } from '@/lib/comments/model';
import type { LoadResult } from './build-loader';
import { createPageController, isOverlayVisible, type PageState } from './controller';

/** The build page had no discussion to read; these tests are about the build. */
const NO_COMMENTS = { status: 'unavailable', resourceId: null, authorId: null, total: null } as const;

const A = 'https://mobalytics.gg/poe-2/builds/build-a';
const B = 'https://mobalytics.gg/poe-2/builds/build-b';
const LIST = 'https://mobalytics.gg/poe-2/builds';

const build = (title: string) => ({ title }) as Build;

function deferred() {
  let resolve!: (result: LoadResult) => void;
  const promise = new Promise<LoadResult>((r) => (resolve = r));
  return { promise, resolve };
}

function setup(initialMode: 'extension' | 'original' = 'extension') {
  const pending = new Map<string, ReturnType<typeof deferred>>();
  const load = vi.fn((url: string) => {
    const d = deferred();
    pending.set(url, d);
    return d.promise;
  });
  const onModeChange = vi.fn();
  const controller = createPageController({ load, initialMode, onModeChange });
  const states: PageState[] = [];
  controller.subscribe((state) => states.push(state));
  const settle = async (url: string, result: LoadResult) => {
    pending.get(url)!.resolve(result);
    await vi.waitFor(() => expect(controller.getState()).not.toMatchObject({ status: 'loading', url }));
  };
  return { controller, load, onModeChange, states, settle };
}

describe('createPageController', () => {
  it('shows how a slow load is going while it waits', async () => {
    const { controller } = setup();
    let report!: (progress: { attempt: number; attempts: number }) => void;
    const load = vi.fn((_url: string, onProgress: (progress: { attempt: number; attempts: number }) => void) => {
      report = onProgress;
      return new Promise<LoadResult>(() => {});
    });
    const slow = createPageController({ load, initialMode: 'extension' });
    void controller;

    slow.handleUrl(A);
    report({ attempt: 2, attempts: 4 });

    expect(slow.getState()).toMatchObject({ status: 'loading', progress: { attempt: 2, attempts: 4 } });
  });

  it('starts inactive', () => {
    expect(setup().controller.getState()).toEqual({ active: false, mode: 'extension' });
  });

  it("loads a profile's build addressed by id", () => {
    const { controller, load } = setup();

    controller.handleUrl('https://mobalytics.gg/poe-2/profile/some-player/builds/e4321b1e-aa41-4c49-855d-97ffba18f5f5');

    expect(load).toHaveBeenCalledOnce();
    expect(controller.getState()).toMatchObject({ active: true, key: 'some-player/e4321b1e-aa41-4c49-855d-97ffba18f5f5' });
  });

  it('loads a build published from a profile under its slug, keyed with the profile', () => {
    const { controller, load } = setup();
    const url = 'https://mobalytics.gg/poe-2/profile/some-player/builds/frost-witch';

    controller.handleUrl(url);

    expect(load).toHaveBeenCalledWith(url, expect.any(Function));
    expect(controller.getState()).toMatchObject({ active: true, key: 'some-player/frost-witch', status: 'loading' });
  });

  it('ignores pages that are not builds', () => {
    const { controller, load } = setup();

    controller.handleUrl(LIST);

    expect(load).not.toHaveBeenCalled();
    expect(controller.getState()).toMatchObject({ active: false });
  });

  it('loads a build page and becomes ready', async () => {
    const { controller, settle } = setup();

    controller.handleUrl(A);
    expect(controller.getState()).toEqual({ active: true, mode: 'extension', url: A, key: 'build-a', status: 'loading' });

    await settle(A, { ok: true, comments: NO_COMMENTS, build: build('Build A') });
    expect(controller.getState()).toEqual({ active: true, mode: 'extension', url: A, key: 'build-a', status: 'ready', build: build('Build A'), comments: null });
  });

  it('shows a load failure', async () => {
    const { controller, settle } = setup();

    controller.handleUrl(A);
    await settle(A, { ok: false, message: "Couldn't read the build" });

    expect(controller.getState()).toMatchObject({ status: 'error', message: "Couldn't read the build" });
  });

  it('loads the same build again after a failure', async () => {
    const { controller, load, settle } = setup();

    controller.handleUrl(A);
    await settle(A, { ok: false, message: 'offline' });
    controller.retry();

    expect(load).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toMatchObject({ status: 'loading', key: 'build-a' });
    await settle(A, { ok: true, comments: NO_COMMENTS, build: build('Build A') });
    expect(controller.getState()).toMatchObject({ status: 'ready', build: { title: 'Build A' } });
  });

  it('retries only a failed build', async () => {
    const { controller, load, settle } = setup();

    controller.retry();
    controller.handleUrl(A);
    await settle(A, { ok: true, comments: NO_COMMENTS, build: build('Build A') });
    controller.retry();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('shows an error when loading throws', async () => {
    const controller = createPageController({ load: async () => Promise.reject(new Error('boom')), initialMode: 'extension' });

    controller.handleUrl(A);

    await vi.waitFor(() => expect(controller.getState()).toMatchObject({ status: 'error', message: 'boom' }));
  });

  it('does not reload when only the query or hash of the same build changes', async () => {
    const { controller, load, settle } = setup();

    controller.handleUrl(A);
    await settle(A, { ok: true, comments: NO_COMMENTS, build: build('Build A') });
    controller.handleUrl(`${A}?weaponSet=set2#skills`);

    expect(load).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({ status: 'ready' });
  });

  it('ignores a stale result after navigating to another build', async () => {
    const { controller, settle } = setup();

    controller.handleUrl(A);
    controller.handleUrl(B);
    await settle(B, { ok: true, comments: NO_COMMENTS, build: build('Build B') });
    await settle(A, { ok: true, comments: NO_COMMENTS, build: build('Build A') });

    expect(controller.getState()).toMatchObject({ key: 'build-b', status: 'ready', build: { title: 'Build B' } });
  });

  it('deactivates when leaving build pages and loads again on return', async () => {
    const { controller, load, settle } = setup();

    controller.handleUrl(A);
    await settle(A, { ok: true, comments: NO_COMMENTS, build: build('Build A') });
    controller.handleUrl(LIST);
    expect(controller.getState()).toEqual({ active: false, mode: 'extension' });

    controller.handleUrl(A);
    expect(load).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toMatchObject({ status: 'loading' });
  });

  it('switches mode, keeps it across navigation and reports it', async () => {
    const { controller, onModeChange } = setup();

    controller.handleUrl(A);
    controller.setMode('original');
    controller.handleUrl(B);

    expect(controller.getState()).toMatchObject({ mode: 'original', key: 'build-b' });
    expect(onModeChange).toHaveBeenCalledOnce();
    expect(onModeChange).toHaveBeenCalledWith('original');

    controller.setMode('original');
    expect(onModeChange).toHaveBeenCalledOnce();
  });

  it('notifies subscribers until they unsubscribe', () => {
    const { controller } = setup('original');
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    controller.handleUrl(A);
    unsubscribe();
    controller.setMode('extension');

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ status: 'loading', mode: 'original' }));
  });
});

describe('createPageController comments', () => {
  const fakeComments = (seed: CommentsSeed) => ({ seed, dispose: vi.fn() }) as unknown as CommentsController & { seed: CommentsSeed; dispose: ReturnType<typeof vi.fn> };

  function withComments() {
    const pending = new Map<string, ReturnType<typeof deferred>>();
    const load = vi.fn((url: string) => {
      const d = deferred();
      pending.set(url, d);
      return d.promise;
    });
    const createComments = vi.fn(fakeComments);
    const controller = createPageController({ load, initialMode: 'extension', createComments });
    const settle = async (url: string, result: LoadResult) => {
      pending.get(url)!.resolve(result);
      await vi.waitFor(() => expect(controller.getState()).not.toMatchObject({ status: 'loading', url }));
    };
    const comments = () => (controller.getState() as { comments?: ReturnType<typeof fakeComments> }).comments;
    return { controller, createComments, settle, comments };
  }

  it("gives each loaded build its own discussion, started from the page's comments", async () => {
    const { controller, createComments, settle, comments } = withComments();

    controller.handleUrl(A);
    await settle(A, { ok: true, comments: NO_COMMENTS, build: build('Build A') });

    expect(createComments).toHaveBeenCalledWith(NO_COMMENTS);
    expect(comments()!.seed).toBe(NO_COMMENTS);
  });

  it('keeps the discussion while only the mode or hash changes', async () => {
    const { controller, createComments, settle, comments } = withComments();
    controller.handleUrl(A);
    await settle(A, { ok: true, comments: NO_COMMENTS, build: build('Build A') });
    const first = comments();

    controller.setMode('original');
    controller.handleUrl(`${A}#comments`);

    expect(comments()).toBe(first);
    expect(first!.dispose).not.toHaveBeenCalled();
    expect(createComments).toHaveBeenCalledOnce();
  });

  it('closes the discussion when the reader moves to another build or leaves build pages', async () => {
    const { controller, settle, comments } = withComments();
    controller.handleUrl(A);
    await settle(A, { ok: true, comments: NO_COMMENTS, build: build('Build A') });
    const first = comments()!;

    controller.handleUrl(B);
    expect(first.dispose).toHaveBeenCalledOnce();

    await settle(B, { ok: true, comments: NO_COMMENTS, build: build('Build B') });
    const second = comments()!;
    controller.handleUrl(LIST);
    expect(second.dispose).toHaveBeenCalledOnce();
  });

  it('never starts a discussion for a load that was superseded', async () => {
    const { controller, createComments, settle } = withComments();

    controller.handleUrl(A);
    controller.handleUrl(B);
    await settle(B, { ok: true, comments: NO_COMMENTS, build: build('Build B') });
    await settle(A, { ok: true, comments: NO_COMMENTS, build: build('Build A') });

    expect(createComments).toHaveBeenCalledOnce();
  });
});

describe('isOverlayVisible', () => {
  it('is visible only on an active build page in extension mode', () => {
    expect(isOverlayVisible({ active: false, mode: 'extension' })).toBe(false);
    expect(isOverlayVisible({ active: true, mode: 'original', url: A, key: 'build-a', status: 'loading' })).toBe(false);
    expect(isOverlayVisible({ active: true, mode: 'extension', url: A, key: 'build-a', status: 'loading' })).toBe(true);
  });
});
