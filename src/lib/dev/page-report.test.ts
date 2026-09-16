import { describe, expect, it, vi } from 'vitest';
import { listenForPageReport } from './page-report';

const CHANNEL = { event: 'test:report', attribute: 'data-test-report' };

function readReport() {
  return JSON.parse(document.documentElement.getAttribute(CHANNEL.attribute) ?? 'null');
}

describe('listenForPageReport', () => {
  it('writes the produced report as JSON on the root element', async () => {
    const stop = listenForPageReport(document, CHANNEL, async () => ({ title: 'Build' }));

    document.dispatchEvent(new Event(CHANNEL.event));

    await vi.waitFor(() => expect(readReport()).toEqual({ title: 'Build' }));
    stop();
  });

  it('clears a previous report before producing a new one', async () => {
    document.documentElement.setAttribute(CHANNEL.attribute, '"stale"');
    let finish!: () => void;
    const stop = listenForPageReport(document, CHANNEL, () => new Promise((resolve) => (finish = () => resolve('fresh'))));

    document.dispatchEvent(new Event(CHANNEL.event));

    expect(document.documentElement.hasAttribute(CHANNEL.attribute)).toBe(false);
    finish();
    await vi.waitFor(() => expect(readReport()).toBe('fresh'));
    stop();
  });

  it('reports a thrown error', async () => {
    const stop = listenForPageReport(document, CHANNEL, async () => {
      throw new Error('boom');
    });

    document.dispatchEvent(new Event(CHANNEL.event));

    await vi.waitFor(() => expect(readReport()).toEqual({ ok: false, message: 'boom' }));
    stop();
  });

  it('stops listening', () => {
    const produce = vi.fn(async () => 1);
    listenForPageReport(document, CHANNEL, produce)();

    document.dispatchEvent(new Event(CHANNEL.event));

    expect(produce).not.toHaveBeenCalled();
  });
});
