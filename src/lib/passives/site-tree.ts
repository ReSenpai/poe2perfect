export type TreeKind = 'passive-tree' | 'atlas-tree';

export interface WidgetSection {
  section: HTMLElement;
  variantIndex: number;
}

/** Widgets that belong to a variant; their anchor ids end with the index of the variant the site shows. */
const VARIANT_WIDGETS = ['passive-tree', 'atlas-tree', 'equipment', 'skill-gems'];

/**
 * The site's passive or atlas tree widget. The site remounts the whole section when the variant changes (and has no
 * atlas section for a variant without an atlas tree), so look it up again after each change.
 */
export function findTreeSection(doc: Document, kind: TreeKind = 'passive-tree'): WidgetSection | null {
  return findWidget(doc, [kind]);
}

/** Any widget that shows the site's current variant and has tabs to change it. */
export function findVariantSection(doc: Document): WidgetSection | null {
  return findWidget(doc, VARIANT_WIDGETS);
}

function findWidget(doc: Document, kinds: string[]): WidgetSection | null {
  const pattern = new RegExp(`-(?:${kinds.join('|')})-(\\d+)$`);
  for (const anchor of doc.querySelectorAll<HTMLElement>('span[id]')) {
    const match = pattern.exec(anchor.id);
    if (match && anchor.parentElement?.querySelector('[role=tab]')) return { section: anchor.parentElement, variantIndex: Number(match[1]) };
  }
  return null;
}

/**
 * The block holding the tree canvas and its zoom controls: the outermost ancestor of the canvas without any text
 * (which stops right below the block that also holds the point counters), or the first one that sets the tree's
 * minimum height, so the block can be sized down. Null until the site creates the canvas.
 */
export function findTreeSlot(section: HTMLElement): HTMLElement | null {
  const canvas = section.querySelector('canvas');
  if (!canvas) return null;
  let slot: HTMLElement = canvas;
  while (slot.parentElement && slot.parentElement !== section && !hasText(slot.parentElement)) {
    slot = slot.parentElement;
    if (hasMinHeight(slot)) break;
  }
  return slot === canvas ? null : slot;
}

/** Clicks the site's tab for a variant; false when there's no such tab. */
export function selectSiteVariant(section: HTMLElement, variantIndex: number): boolean {
  const tab = section.querySelectorAll<HTMLElement>('[role=tab]')[variantIndex];
  if (!tab) return false;
  tab.click();
  return true;
}

function hasMinHeight(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView;
  return view !== null && parseFloat(view.getComputedStyle(element).minHeight) > 0;
}

function hasText(element: Element): boolean {
  return (element.textContent ?? '').trim() !== '';
}
