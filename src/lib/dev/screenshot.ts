/** Dev tool: screenshots of the guide for the store listing and the README, saved to Downloads as PNG. */
export const SCREENSHOT_MESSAGE = 'poe2-build-guide:screenshot';

/** The folder in Downloads the screenshots go to. */
export const SCREENSHOT_FOLDER = 'poe2perfect-screenshots';

type Answer = { ok: true; saved: string } | { ok: false; message: string };

/** Asks the dev background to capture this tab and save it as `<SCREENSHOT_FOLDER>/<name>.png`. */
export async function saveScreenshot(name: string, send: (message: unknown) => Promise<unknown>) {
  const answer = (await send({ type: SCREENSHOT_MESSAGE, name })) as Answer | undefined;
  if (!answer?.ok) throw new Error(answer?.message ?? 'No answer from the background');
  return { saved: answer.saved };
}
