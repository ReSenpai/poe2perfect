/** Dev tool: screenshots of the guide for the store listing and the README, saved to Downloads as PNG. */
export const SCREENSHOT_MESSAGE = 'poe2-build-guide:screenshot';

type Answer = { ok: true; dataUrl: string } | { ok: false; message: string };

/** Asks the dev background for a screenshot of this tab and saves it as `<name>.png`. */
export async function saveScreenshot(doc: Document, name: string, send: (message: unknown) => Promise<unknown>) {
  const answer = (await send({ type: SCREENSHOT_MESSAGE })) as Answer | undefined;
  if (!answer?.ok) throw new Error(answer?.message ?? 'No answer from the background');
  const link = Object.assign(doc.createElement('a'), { href: answer.dataUrl, download: `${name}.png` });
  doc.body.append(link);
  link.click();
  link.remove();
  return { saved: `${name}.png`, bytes: Math.round((answer.dataUrl.length * 3) / 4) };
}
