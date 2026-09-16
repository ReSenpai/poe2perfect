import { describe, expect, it, vi } from 'vitest';
import type { CaptureResult } from './fixture';
import { PAGE_CAPTURE_ATTRIBUTE, PAGE_CAPTURE_EVENT, listenForPageCapture } from './page-capture';

const SUCCESS: CaptureResult = {
  ok: true,
  fileName: 'b.json',
  warnings: ['w'],
  fixture: {
    meta: { slug: 'b', url: 'https://mobalytics.gg/poe-2/builds/b', capturedAt: 'now', staticCacheVersion: 'v1' },
    build: { id: 'd', data: { name: 'Build B', buildVariants: { values: [{}, {}] } }, content: [] },
    staticData: { poe2Gems: { data: [{}, {}, {}] } },
  },
};

function readReport() {
  return JSON.parse(document.documentElement.getAttribute(PAGE_CAPTURE_ATTRIBUTE) ?? 'null');
}

describe('listenForPageCapture', () => {
  it('writes a capture summary to the root element when the page asks', async () => {
    const stop = listenForPageCapture(document, async () => SUCCESS);

    document.dispatchEvent(new Event(PAGE_CAPTURE_EVENT));

    await vi.waitFor(() =>
      expect(readReport()).toEqual({
        ok: true,
        fileName: 'b.json',
        summary: 'Build B · вариантов: 2 · записей справочника: 3',
        warnings: ['w'],
        bytes: JSON.stringify(SUCCESS.ok && SUCCESS.fixture).length,
      }),
    );
    stop();
  });

  it('writes a failure', async () => {
    const stop = listenForPageCapture(document, async () => ({ ok: false, message: 'nope' }));

    document.dispatchEvent(new Event(PAGE_CAPTURE_EVENT));

    await vi.waitFor(() => expect(readReport()).toEqual({ ok: false, message: 'nope' }));
    stop();
  });

  it('stops listening', async () => {
    const capture = vi.fn(async () => SUCCESS);
    listenForPageCapture(document, capture)();

    document.dispatchEvent(new Event(PAGE_CAPTURE_EVENT));

    expect(capture).not.toHaveBeenCalled();
  });
});
