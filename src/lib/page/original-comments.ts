/** The site's comments widget on a build page (its id is the widget's id in the build document). */
const WIDGET = '[data-testid="comment-widget-general"]';
/** Room for the site's sticky header (56 px) and a little air below it. */
const TOP_OFFSET = 72;

/** Brings the site's own discussion into view once the guide stepped aside, waiting for the site to render it. */
export function revealOriginalComments(doc: Document, { timeoutMs = 5_000 }: { timeoutMs?: number } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (found: boolean) => {
      observer?.disconnect();
      if (timer) clearTimeout(timer);
      resolve(found);
    };

    const tryReveal = () => {
      const widget = doc.querySelector<HTMLElement>(WIDGET);
      if (!widget) return false;
      const view = doc.defaultView ?? window;
      view.scrollTo({ top: widget.getBoundingClientRect().top + view.scrollY - TOP_OFFSET });
      finish(true);
      return true;
    };

    if (tryReveal()) return;
    observer = new MutationObserver(() => void tryReveal());
    observer.observe(doc.body, { childList: true, subtree: true });
    timer = setTimeout(() => finish(false), timeoutMs);
  });
}
