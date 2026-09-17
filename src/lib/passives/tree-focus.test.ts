import { beforeEach, describe, expect, it, vi } from 'vitest';
import { treeWidgetHtml } from '../../../tests/fixtures/tree-widget';
import { createTreeFocus } from './tree-focus';

const events = (element: Element) => {
  const seen: string[] = [];
  for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mousemove', 'pointerout', 'pointerleave', 'mouseout', 'pointerdown', 'pointerup', 'click']) {
    element.addEventListener(type, () => seen.push(type));
  }
  return seen;
};

let focus: ReturnType<typeof createTreeFocus>;

describe('createTreeFocus', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = `
      <main>
        ${treeWidgetHtml({ priorityNodes: ['node-1', 'node-2'] })}
        ${treeWidgetHtml({ kind: 'atlas-tree', priorityNodes: ['node-1'] })}
      </main>`;
    focus = createTreeFocus(document, 'passive-tree');
  });

  it("points the site's tree at a node, the way hovering its own priority list does", () => {
    const icon = document.querySelector('.passive-tree [data-priority-slug="node-2"]')!;
    const seen = events(icon);

    focus.highlight('node-2');

    expect(seen).toContain('pointerover');
    expect(seen).toContain('mousemove');
    expect(seen).not.toContain('pointerout');
  });

  it('lets the highlight go', () => {
    const icon = document.querySelector('.passive-tree [data-priority-slug="node-1"]')!;
    const seen = events(icon);

    focus.highlight('node-1');
    focus.clear();

    expect(seen).toContain('pointerout');
    expect(seen).toContain('pointerleave');
  });

  it("passes a click on to the site's own list entry", () => {
    const icon = document.querySelector('.passive-tree [data-priority-slug="node-1"]')!;
    const seen = events(icon);

    focus.select('node-1');

    expect(seen.filter((type) => ['pointerdown', 'pointerup', 'click'].includes(type))).toEqual(['pointerdown', 'pointerup', 'click']);
  });

  it("keeps the site's own tooltip away while the guide drives the highlight, since the guide shows its own", () => {
    const hidden = () => [...document.head.querySelectorAll('style')].some((style) => (style.textContent ?? '').includes('data-tippy-root'));

    focus.highlight('node-1');
    expect(hidden()).toBe(true);

    focus.clear();
    expect(hidden()).toBe(false);
  });

  it('stays inside its own tree, so the atlas and the passive tree never mix up nodes', () => {
    const atlasIcon = document.querySelector('.atlas-tree [data-priority-slug="node-1"]')!;
    const seen = events(atlasIcon);

    focus.highlight('node-1');

    expect(seen).toEqual([]);
  });

  it('does nothing for a node the site does not list, or before the tree is there', () => {
    expect(() => focus.highlight('node-404')).not.toThrow();
    expect(() => focus.select('node-404')).not.toThrow();

    document.body.innerHTML = '';
    expect(() => createTreeFocus(document, 'passive-tree').highlight('node-1')).not.toThrow();
  });
});
