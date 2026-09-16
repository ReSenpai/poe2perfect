export interface PageReportChannel {
  event: string;
  attribute: string;
}

/**
 * Dev hook for automated checks: the page dispatches `channel.event` and reads a JSON report
 * from `channel.attribute` on the root element. Only the report is exposed to the page.
 */
export function listenForPageReport(target: Document, channel: PageReportChannel, produce: () => Promise<unknown>): () => void {
  const listener = () => {
    target.documentElement.removeAttribute(channel.attribute);
    void produce()
      .catch((error: unknown) => ({ ok: false, message: error instanceof Error ? error.message : String(error) }))
      .then((report) => target.documentElement.setAttribute(channel.attribute, JSON.stringify(report)));
  };
  target.addEventListener(channel.event, listener);
  return () => target.removeEventListener(channel.event, listener);
}
