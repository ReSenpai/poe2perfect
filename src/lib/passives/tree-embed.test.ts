import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { treeWidgetHtml } from '../../../tests/fixtures/tree-widget';
import { embedSiteTree, type TreeEmbed, type TreeEmbedStatus } from './tree-embed';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let placeholder: HTMLElement;
let rect: { left: number; top: number; width: number; height: number };
let statuses: TreeEmbedStatus[];
let embed: TreeEmbed | null;

const slot = () => document.querySelector<HTMLElement>('.tree-slot')!;
const lastStatus = () => statuses.at(-1);

function start(variantIndex = 1, kind: 'passive-tree' | 'atlas-tree' = 'passive-tree') {
  embed = embedSiteTree({ doc: document, win: window, kind, placeholder, variantIndex, onStatus: (status) => statuses.push(status) });
  return embed;
}

function renderSite(options: Parameters<typeof treeWidgetHtml>[0]) {
  document.querySelector('.site')!.innerHTML = treeWidgetHtml(options);
}

describe('embedSiteTree', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = `<main class="site">${treeWidgetHtml({ variantIndex: 1 })}</main><div class="guide"><div class="placeholder"></div></div>`;
    placeholder = document.querySelector('.placeholder')!;
    rect = { left: 40, top: 120, width: 900, height: 500 };
    placeholder.getBoundingClientRect = () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({}) });
    Element.prototype.scrollIntoView = vi.fn();
    statuses = [];
    embed = null;
  });

  afterEach(() => embed?.destroy());

  it("lays the site's tree over the placeholder, above the guide", () => {
    start();

    const style = slot().style;
    expect(style.getPropertyValue('position')).toBe('fixed');
    expect([style.getPropertyValue('left'), style.getPropertyValue('top'), style.getPropertyValue('width'), style.getPropertyValue('height')]).toEqual([
      '40px',
      '120px',
      '900px',
      '500px',
    ]);
    expect(style.getPropertyValue('z-index')).toBe('2147483647');
    expect(style.getPropertyValue('min-height')).toBe('0');
    expect(lastStatus()).toBe('ready');
  });

  it('marks the tree block while it is laid over the guide', () => {
    start().destroy();
    embed = null;
    expect(slot().hasAttribute('data-poe2-build-guide-tree')).toBe(false);

    start();
    expect(slot().hasAttribute('data-poe2-build-guide-tree')).toBe(true);
  });

  it("keeps fixed positioning working inside the site's size containers", () => {
    start();

    expect(document.querySelector<HTMLElement>('.tree-body')!.style.getPropertyValue('container-type')).toBe('normal');
  });

  it("raises the site's own tooltips above the guide while the tree is shown", () => {
    start();

    expect(document.head.querySelector('style')?.textContent).toContain('[data-tippy-root]');
  });

  it('keeps the tree block it took after lowering its minimum height', async () => {
    const root = document.querySelector<HTMLElement>('.tree-root')!;
    root.setAttribute('style', 'min-height: 580px');

    start();
    document.querySelector('.notables')!.append(document.createElement('div'));
    await flush();

    expect(root.style.getPropertyValue('position')).toBe('fixed');
    expect(slot().style.getPropertyValue('position')).toBe('');
  });

  it('follows the placeholder when it moves or resizes', () => {
    start();
    rect = { left: 40, top: 60, width: 900, height: 560 };

    window.dispatchEvent(new Event('resize'));

    expect([slot().style.getPropertyValue('top'), slot().style.getPropertyValue('height')]).toEqual(['60px', '560px']);
  });

  it('switches the site to the wanted variant and takes the tree it remounts', async () => {
    const clicked = vi.fn();
    document.querySelectorAll('[role=tab]')[2]!.addEventListener('click', clicked);

    start(2);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(lastStatus()).toBe('loading');
    expect(slot().style.getPropertyValue('position')).toBe('');

    renderSite({ variantIndex: 2 });
    await flush();

    expect(slot().style.getPropertyValue('position')).toBe('fixed');
    expect(lastStatus()).toBe('ready');
  });

  it("keeps the guide's hash when the site rewrites the URL for the variant", async () => {
    window.history.replaceState(null, '', '/poe-2/builds/lich#passives_endgame');
    document.querySelectorAll('[role=tab]')[2]!.addEventListener('click', () => window.history.replaceState(null, '', '/poe-2/builds/lich?variant=3'));

    start(2);
    renderSite({ variantIndex: 2 });
    await flush();

    expect(window.location.search).toBe('?variant=3');
    expect(window.location.hash).toBe('#passives_endgame');
  });

  it('clicks a variant tab once while the site is still switching', async () => {
    const clicked = vi.fn();
    document.querySelectorAll('[role=tab]')[2]!.addEventListener('click', clicked);

    start(2);
    document.querySelector('.notables')!.append(document.createElement('div'));
    await flush();

    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it('clicks the variant tab again while the site ignores it (still starting up)', () => {
    vi.useFakeTimers();
    try {
      const clicked = vi.fn();
      document.querySelectorAll('[role=tab]')[2]!.addEventListener('click', clicked);

      start(2);
      vi.advanceTimersByTime(1000);
      expect(clicked).toHaveBeenCalledTimes(2);

      renderSite({ variantIndex: 2 });
      embed!.sync();
      vi.advanceTimersByTime(3000);
      expect(clicked).toHaveBeenCalledTimes(2);
      expect(lastStatus()).toBe('ready');
    } finally {
      vi.useRealTimers();
    }
  });

  it('scrolls the tree out of view and back again while the site still has not created it', () => {
    vi.useFakeTimers();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
      renderSite({ variantIndex: 1, withCanvas: false });

      start();
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);

      // The site starts the tree when it comes into view, so it has to leave the view first.
      vi.advanceTimersByTime(1000);
      expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000);
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2);
    } finally {
      scrollTo.mockRestore();
      vi.useRealTimers();
    }
  });

  it('changes variant on request', () => {
    const clicked = vi.fn();
    document.querySelectorAll('[role=tab]')[0]!.addEventListener('click', clicked);

    start(1).setVariant(0);

    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it('scrolls a tree the site has not created yet into view, so the site starts it', async () => {
    renderSite({ variantIndex: 1, withCanvas: false });

    start();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(lastStatus()).toBe('loading');

    renderSite({ variantIndex: 1 });
    await flush();
    expect(lastStatus()).toBe('ready');
  });

  it('embeds the atlas tree, switching the variant through another widget while the site shows no atlas', async () => {
    const clicked = vi.fn();
    document.querySelectorAll('[role=tab]')[2]!.addEventListener('click', clicked);

    start(2, 'atlas-tree');
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(lastStatus()).toBe('loading');

    document.querySelector('.site')!.innerHTML = treeWidgetHtml({ variantIndex: 2 }) + treeWidgetHtml({ variantIndex: 2, kind: 'atlas-tree' });
    await flush();

    expect(document.querySelector<HTMLElement>('.atlas-tree .tree-slot')!.style.getPropertyValue('position')).toBe('fixed');
    expect(document.querySelector<HTMLElement>('.passive-tree .tree-slot')!.style.getPropertyValue('position')).toBe('');
    expect(lastStatus()).toBe('ready');
  });

  it('reports a variant the site shows without an atlas tree', () => {
    start(1, 'atlas-tree');

    expect(lastStatus()).toBe('missing');
  });

  it('reports a page without a passive tree', () => {
    document.querySelector('.site')!.innerHTML = '';

    start();

    expect(lastStatus()).toBe('missing');
  });

  it('puts the page back as it was when it is done', () => {
    const body = document.querySelector<HTMLElement>('.tree-body')!;
    body.style.setProperty('container-type', 'inline-size');
    slot().setAttribute('style', 'min-height: 580px;');

    start().destroy();
    embed = null;

    expect(slot().getAttribute('style')).toBe('min-height: 580px;');
    expect(body.style.getPropertyValue('container-type')).toBe('inline-size');
    expect(document.head.querySelector('style')).toBeNull();
  });

  it('stops following the site after it is done', async () => {
    start(2).destroy();
    embed = null;

    renderSite({ variantIndex: 2 });
    await flush();

    expect(slot().style.getPropertyValue('position')).toBe('');
  });
});
