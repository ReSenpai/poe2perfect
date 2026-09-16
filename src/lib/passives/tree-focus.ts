import { findTreeSection, type TreeKind } from './site-tree';

export interface TreeFocus {
  /** Rings the node on the site's tree, as hovering its own priority list does. */
  highlight(nodeSlug: string): void;
  clear(): void;
  /** Passes a click on to the site's list entry for the node. */
  select(nodeSlug: string): void;
}

const POINTER = { bubbles: true, cancelable: true, pointerType: 'mouse', pointerId: 1, isPrimary: true, button: 0 } as const;

/**
 * Drives the tree the site draws through its own "Notable Priority" entries, which carry the node slug in
 * `data-priority-slug`. Looking them up inside the tree's own section keeps the passive and atlas trees apart.
 */
export function createTreeFocus(doc: Document, kind: TreeKind): TreeFocus {
  let highlighted: HTMLElement | null = null;

  const entry = (nodeSlug: string): HTMLElement | null => {
    const section = findTreeSection(doc, kind)?.section;
    return section?.querySelector<HTMLElement>(`[data-priority-slug="${CSS.escape(nodeSlug)}"]`) ?? null;
  };

  const send = (element: HTMLElement, types: string[]) => {
    const box = element.getBoundingClientRect();
    const init = { ...POINTER, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
    for (const type of types) {
      element.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, init) : new MouseEvent(type, init));
    }
  };

  const clear = () => {
    if (highlighted) send(highlighted, ['pointerout', 'pointerleave', 'mouseout', 'mouseleave']);
    highlighted = null;
  };

  return {
    highlight(nodeSlug) {
      const element = entry(nodeSlug);
      if (!element || element === highlighted) return;
      clear();
      highlighted = element;
      send(element, ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointermove', 'mousemove']);
    },
    clear,
    select(nodeSlug) {
      const element = entry(nodeSlug);
      if (!element) return;
      send(element, ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
    },
  };
}
