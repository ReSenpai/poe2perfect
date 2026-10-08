import { SCREENSHOT_FOLDER, SCREENSHOT_MESSAGE } from '@/lib/dev/screenshot';

/**
 * Dev only (left out of production builds in wxt.config.ts): takes a screenshot of the tab a content script asks
 * from, for the store listing and the README, and saves it to Downloads. Only the tab shown in its window can be
 * captured, so a tab in the background is brought to the front for the shot, and the tab that was in front gets it
 * back. Saving from here, not from the page, avoids the browser's prompt about pages downloading many files.
 */
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    const request = message as { type?: unknown; name?: unknown } | null;
    if (request?.type !== SCREENSHOT_MESSAGE || !sender.tab?.id) return;
    const name = typeof request.name === 'string' && /^[\w.-]+$/.test(request.name) ? request.name : 'screenshot';
    const filename = `${SCREENSHOT_FOLDER}/${name}.png`;
    return capture(sender.tab.id, sender.tab.windowId)
      .then((url) => browser.downloads.download({ url, filename, conflictAction: 'overwrite', saveAs: false }))
      .then(() => ({ ok: true, saved: filename }))
      .catch((error: unknown) => ({ ok: false, message: error instanceof Error ? error.message : String(error) }));
  });
});

async function capture(tabId: number, windowId: number): Promise<string> {
  const [shown] = await browser.tabs.query({ active: true, windowId });
  if (shown?.id === tabId) return browser.tabs.captureVisibleTab(windowId, { format: 'png' });
  await browser.tabs.update(tabId, { active: true });
  // Let the tab paint before the shot.
  await new Promise((resolve) => setTimeout(resolve, 600));
  try {
    return await browser.tabs.captureVisibleTab(windowId, { format: 'png' });
  } finally {
    if (shown?.id) await browser.tabs.update(shown.id, { active: true });
  }
}
