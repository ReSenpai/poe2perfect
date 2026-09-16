import { beforeEach, describe, expect, it } from 'vitest';
import { treeWidgetHtml } from '../../../tests/fixtures/tree-widget';
import { findTreeSection, findTreeSlot, findVariantSection, selectSiteVariant } from './site-tree';

describe('site passive tree', () => {
  beforeEach(() => {
    document.body.innerHTML = `<main><section><span id="abc-equipment-0"></span></section>${treeWidgetHtml({ variantIndex: 1 })}</main>`;
  });

  it('finds the passive tree section and the variant it shows', () => {
    const found = findTreeSection(document);

    expect(found?.section.classList.contains('tree-section')).toBe(true);
    expect(found?.variantIndex).toBe(1);
  });

  it('finds the atlas tree section by its kind', () => {
    document.body.innerHTML = `<main>${treeWidgetHtml({ variantIndex: 1 })}${treeWidgetHtml({ variantIndex: 1, kind: 'atlas-tree' })}</main>`;

    expect(findTreeSection(document, 'atlas-tree')?.section.classList.contains('atlas-tree')).toBe(true);
    expect(findTreeSection(document)?.section.classList.contains('passive-tree')).toBe(true);
  });

  it('tells the variant the site shows from any widget with variant tabs', () => {
    document.body.innerHTML = `<main><section><span id="abc-build-variants-0"></span><div role="tab"></div></section>${treeWidgetHtml({ variantIndex: 2 })}</main>`;

    const found = findVariantSection(document);
    expect(found?.variantIndex).toBe(2);
    expect(found?.section.classList.contains('passive-tree')).toBe(true);
  });

  it('finds nothing on a page without a passive tree', () => {
    document.body.innerHTML = '<main><section><span id="abc-equipment-0"></span></section></main>';

    expect(findTreeSection(document)).toBeNull();
  });

  it('takes the whole text-free block around the canvas as the tree slot', () => {
    const { section } = findTreeSection(document)!;

    expect(findTreeSlot(section)?.classList.contains('tree-slot')).toBe(true);
  });

  it('stops at the block that sets the height of the tree', () => {
    document.body.innerHTML = treeWidgetHtml({ kind: 'atlas-tree' });
    const root = document.querySelector('.tree-root')!;
    root.setAttribute('style', 'min-height: 644px');

    expect(findTreeSlot(findTreeSection(document, 'atlas-tree')!.section)).toBe(root);
  });

  it('has no tree slot until the site has created the canvas', () => {
    document.body.innerHTML = treeWidgetHtml({ withCanvas: false });

    expect(findTreeSlot(findTreeSection(document)!.section)).toBeNull();
  });

  it('switches the site to a variant by clicking its tab', () => {
    const { section } = findTreeSection(document)!;
    const clicked: string[] = [];
    section.querySelectorAll('[role=tab]').forEach((tab) => tab.addEventListener('click', () => clicked.push(tab.textContent ?? '')));

    expect(selectSiteVariant(section, 2)).toBe(true);
    expect(clicked).toEqual(['ENDGAME']);
  });

  it('reports a variant the site has no tab for', () => {
    expect(selectSiteVariant(findTreeSection(document)!.section, 7)).toBe(false);
  });
});
