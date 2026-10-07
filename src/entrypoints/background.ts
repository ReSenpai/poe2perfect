import { SCREENSHOT_MESSAGE } from '@/lib/dev/screenshot';

/**
 * Dev only (left out of production builds in wxt.config.ts): takes a screenshot of the tab a content script asks
 * from, for the store listing and the README. The tab has to be the one shown in its window.
 */
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if ((message as { type?: unknown } | null)?.type !== SCREENSHOT_MESSAGE || !sender.tab) return;
    if (!sender.tab.active) return Promise.resolve({ ok: false, message: 'The tab is not the one shown in its window' });
    return browser.tabs
      .captureVisibleTab(sender.tab.windowId, { format: 'png' })
      .then((dataUrl) => ({ ok: true, dataUrl }))
      .catch((error: unknown) => ({ ok: false, message: error instanceof Error ? error.message : String(error) }));
  });
});
