import { FOCUS_ALLOWED_ATTRIBUTE } from '@/lib/page/focus-guard';
import { findTreeSection, findTreeSlot, findVariantSection, selectSiteVariant, type TreeKind } from './site-tree';

export type TreeEmbedStatus = 'loading' | 'ready' | 'missing';

export interface TreeEmbed {
  setVariant(variantIndex: number): void;
  /** Re-reads the site and the placeholder position. */
  sync(): void;
  destroy(): void;
}

const TOP = '2147483647';
// Until the site has hydrated it ignores clicks, and it may scroll the page back: try again while nothing happens.
const RETRY_MS = 1000;
// The site renders tooltips (tippy) at z-index 9999, under the guide.
const PAGE_CSS = '[data-tippy-root] { z-index: 2147483647 !important; }';

/**
 * Shows the site's own passive tree inside the guide: the tree block stays where the site renders it, but is laid
 * over the placeholder with fixed positioning, so the site keeps running it (zoom, pan, tooltips, variant changes).
 * Everything touched on the page is put back on destroy.
 */
export function embedSiteTree({
  doc,
  win,
  kind = 'passive-tree',
  placeholder,
  variantIndex,
  onStatus,
}: {
  doc: Document;
  win: Window;
  kind?: TreeKind;
  placeholder: HTMLElement;
  variantIndex: number;
  onStatus: (status: TreeEmbedStatus) => void;
}): TreeEmbed {
  let wanted = variantIndex;
  let status: TreeEmbedStatus | null = null;
  let slot: { element: HTMLElement; style: string | null } | null = null;
  const containers = new Map<HTMLElement, string>();
  let clickedFor = new WeakMap<HTMLElement, number>();
  let scrolled = new WeakSet<HTMLElement>();
  // Retries alternate between scrolling the page away and back: the site only reacts to the tree coming into view.
  let scrollAway = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let savedScroll: { x: number; y: number } | null = null;
  // The site rewrites the URL for a variant and drops the hash the guide keeps its route in.
  let hashBeforeClick = '';
  let destroyed = false;

  const pageStyle = doc.createElement('style');
  pageStyle.textContent = PAGE_CSS;
  doc.head.append(pageStyle);

  const setStatus = (next: TreeEmbedStatus) => {
    if (next === 'loading') scheduleRetry();
    else stopRetry();
    if (next === status) return;
    status = next;
    onStatus(next);
  };

  const scheduleRetry = () => {
    retryTimer ??= setTimeout(() => {
      retryTimer = null;
      clickedFor = new WeakMap();
      scrolled = new WeakSet();
      scrollAway = !scrollAway;
      sync();
    }, RETRY_MS);
  };

  const stopRetry = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };

  const releaseSlot = () => {
    if (!slot) return;
    const { element, style } = slot;
    if (style === null) element.removeAttribute('style');
    else element.setAttribute('style', style);
    element.removeAttribute(FOCUS_ALLOWED_ATTRIBUTE);
    slot = null;
  };

  const liftContainers = (element: HTMLElement) => {
    // Size containment makes an ancestor the containing block of fixed elements, which would break the overlay.
    for (let node = element.parentElement; node; node = node.parentElement) {
      if (containers.has(node)) continue;
      containers.set(node, node.style.getPropertyValue('container-type'));
      node.style.setProperty('container-type', 'normal', 'important');
    }
  };

  const place = () => {
    if (!slot) return;
    const box = placeholder.getBoundingClientRect();
    const style = slot.element.style;
    style.setProperty('position', 'fixed', 'important');
    style.setProperty('left', `${box.left}px`, 'important');
    style.setProperty('top', `${box.top}px`, 'important');
    style.setProperty('width', `${box.width}px`, 'important');
    style.setProperty('height', `${box.height}px`, 'important');
    style.setProperty('min-width', '0', 'important');
    style.setProperty('min-height', '0', 'important');
    style.setProperty('margin', '0', 'important');
    style.setProperty('z-index', TOP, 'important');
  };

  const restoreHash = () => {
    if (hashBeforeClick && !win.location.hash) win.history.replaceState(win.history.state, '', hashBeforeClick);
  };

  const sync = () => {
    if (destroyed) return;
    restoreHash();
    const found = findTreeSection(doc, kind);
    if (!found || found.variantIndex !== wanted) {
      releaseSlot();
      // Without a tree section (e.g. no atlas for the variant the site shows), switch through another widget.
      const shown = found ?? findVariantSection(doc);
      if (!shown || shown.variantIndex === wanted) {
        setStatus('missing');
        return;
      }
      const { section } = shown;
      if (clickedFor.get(section) !== wanted) {
        hashBeforeClick = win.location.hash;
        if (selectSiteVariant(section, wanted)) clickedFor.set(section, wanted);
        restoreHash();
      }
      setStatus('loading');
      return;
    }

    const { section } = found;
    // Once taken, keep the block: with its minimum height lowered, a new lookup would pick an outer one.
    const keep = slot && section.contains(slot.element) && slot.element.querySelector('canvas');
    const element = keep ? slot!.element : findTreeSlot(section);
    if (!element) {
      releaseSlot();
      if (!scrolled.has(section)) {
        // The site creates the tree lazily, once its section comes into view.
        savedScroll ??= { x: win.scrollX, y: win.scrollY };
        scrolled.add(section);
        if (scrollAway) win.scrollTo(0, 0);
        else section.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
      setStatus('loading');
      return;
    }

    if (slot?.element !== element) {
      releaseSlot();
      slot = { element, style: element.getAttribute('style') };
      // Its zoom buttons stay reachable from the keyboard while the guide keeps focus to itself.
      element.setAttribute(FOCUS_ALLOWED_ATTRIBUTE, '');
      liftContainers(element);
    }
    place();
    setStatus('ready');
  };

  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      sync();
    });
  });
  observer.observe(doc.body, { childList: true, subtree: true });

  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => place());
  resizeObserver?.observe(placeholder);
  win.addEventListener('resize', place);

  sync();

  return {
    setVariant(index) {
      wanted = index;
      sync();
    },
    sync,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopRetry();
      observer.disconnect();
      resizeObserver?.disconnect();
      win.removeEventListener('resize', place);
      releaseSlot();
      containers.forEach((value, node) => {
        if (value) node.style.setProperty('container-type', value);
        else node.style.removeProperty('container-type');
      });
      pageStyle.remove();
      if (savedScroll) win.scrollTo(savedScroll.x, savedScroll.y);
    },
  };
}
