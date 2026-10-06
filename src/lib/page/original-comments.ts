/** The site's comments widget on a build page (its id is the widget's id in the build document). */
const WIDGET = '[data-testid="comment-widget-general"]';
/** The site's own reply box; only signed-in visitors get one. */
const EDITOR = '[role="textbox"][contenteditable="true"]';
/** Room for the site's sticky header (56 px) and a little air below it. */
const TOP_OFFSET = 72;

/**
 * Brings the site's own discussion into view once the guide stepped aside, waiting for the site to render it.
 * With `focusEditor` the cursor goes to the site's reply box when there is one; nothing is typed or sent.
 * Resolves whether the discussion was found.
 */
export function revealOriginalComments(doc: Document, { focusEditor = false, timeoutMs = 5_000 }: { focusEditor?: boolean; timeoutMs?: number } = {}): Promise<boolean> {
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
      if (focusEditor) widget.querySelector<HTMLElement>(EDITOR)?.focus({ preventScroll: true });
      finish(true);
      return true;
    };

    if (tryReveal()) return;
    observer = new MutationObserver(() => void tryReveal());
    observer.observe(doc.body, { childList: true, subtree: true });
    timer = setTimeout(() => finish(false), timeoutMs);
  });
}
