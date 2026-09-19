import { describe, expect, it, vi } from 'vitest';
import type { Build } from '@/lib/build/model';
import type { LoadResult } from './build-loader';
import { createPageController, isOverlayVisible, type PageState } from './controller';

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

  it('ignores pages that are not builds', () => {
    const { controller, load } = setup();

    controller.handleUrl(LIST);

    expect(load).not.toHaveBeenCalled();
    expect(controller.getState()).toMatchObject({ active: false });
  });

  it('loads a build page and becomes ready', async () => {
    const { controller, settle } = setup();

    controller.handleUrl(A);
    expect(controller.getState()).toEqual({ active: true, mode: 'extension', url: A, slug: 'build-a', status: 'loading' });

    await settle(A, { ok: true, build: build('Build A') });
    expect(controller.getState()).toEqual({ active: true, mode: 'extension', url: A, slug: 'build-a', status: 'ready', build: build('Build A') });
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
    expect(controller.getState()).toMatchObject({ status: 'loading', slug: 'build-a' });
    await settle(A, { ok: true, build: build('Build A') });
    expect(controller.getState()).toMatchObject({ status: 'ready', build: { title: 'Build A' } });
  });

  it('retries only a failed build', async () => {
    const { controller, load, settle } = setup();

    controller.retry();
    controller.handleUrl(A);
    await settle(A, { ok: true, build: build('Build A') });
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
    await settle(A, { ok: true, build: build('Build A') });
    controller.handleUrl(`${A}?weaponSet=set2#skills`);

    expect(load).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({ status: 'ready' });
  });

  it('ignores a stale result after navigating to another build', async () => {
    const { controller, settle } = setup();

    controller.handleUrl(A);
    controller.handleUrl(B);
    await settle(B, { ok: true, build: build('Build B') });
    await settle(A, { ok: true, build: build('Build A') });

    expect(controller.getState()).toMatchObject({ slug: 'build-b', status: 'ready', build: { title: 'Build B' } });
  });

  it('deactivates when leaving build pages and loads again on return', async () => {
    const { controller, load, settle } = setup();

    controller.handleUrl(A);
    await settle(A, { ok: true, build: build('Build A') });
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

    expect(controller.getState()).toMatchObject({ mode: 'original', slug: 'build-b' });
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

describe('isOverlayVisible', () => {
  it('is visible only on an active build page in extension mode', () => {
    expect(isOverlayVisible({ active: false, mode: 'extension' })).toBe(false);
    expect(isOverlayVisible({ active: true, mode: 'original', url: A, slug: 'build-a', status: 'loading' })).toBe(false);
    expect(isOverlayVisible({ active: true, mode: 'extension', url: A, slug: 'build-a', status: 'loading' })).toBe(true);
  });
});
