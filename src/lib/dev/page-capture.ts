import { type CaptureResult, summarizeFixture } from './fixture';
import { listenForPageReport } from './page-report';

export const PAGE_CAPTURE_EVENT = 'poe2-build-guide:capture';
export const PAGE_CAPTURE_ATTRIBUTE = 'data-poe2-build-guide-capture';

/** Page-triggered fixture capture that reports a summary, never the fixture itself. */
export function listenForPageCapture(target: Document, capture: () => Promise<CaptureResult>): () => void {
  return listenForPageReport(target, { event: PAGE_CAPTURE_EVENT, attribute: PAGE_CAPTURE_ATTRIBUTE }, async () => {
    const result = await capture();
    if (!result.ok) return result;
    return {
      ok: true,
      fileName: result.fileName,
      summary: summarizeFixture(result.fixture),
      warnings: result.warnings,
      bytes: JSON.stringify(result.fixture).length,
    };
  });
}
