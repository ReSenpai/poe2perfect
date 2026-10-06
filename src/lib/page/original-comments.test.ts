import { afterEach, describe, expect, it, vi } from 'vitest';
import { revealOriginalComments } from './original-comments';

const WIDGET = `
  <section id="w-1" data-testid="comment-widget-general">
    <span id="w-1-comments-0"></span>
    <div role="textbox" contenteditable="true" data-testid="editor"></div>
  </section>`;

function page(html = '') {
  document.body.innerHTML = `<main><p>Guide</p>${html}</main>`;
  const scrolls: number[] = [];
  vi.spyOn(window, 'scrollTo').mockImplementation(((options: ScrollToOptions) => void scrolls.push(options.top!)) as typeof window.scrollTo);
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(1_000);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return { top: this.matches('[data-testid="comment-widget-general"]') ? 400 : 0 } as DOMRect;
  });
  return { scrolls };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('revealOriginalComments', () => {
  it("scrolls the site's comments to the top of the window, clear of the site's sticky header", async () => {
    const { scrolls } = page(WIDGET);

    expect(await revealOriginalComments(document)).toBe(true);

    expect(scrolls).toEqual([1_000 + 400 - 72]);
    expect(document.activeElement).toBe(document.body);
  });

  it("puts the cursor in the site's own reply box when asked to reply", async () => {
    page(WIDGET);

    await revealOriginalComments(document, { focusEditor: true });

    expect(document.activeElement).toBe(document.querySelector('[data-testid="editor"]'));
  });

  it('leaves focus alone when the site shows no reply box, e.g. for a signed-out visitor', async () => {
    page('<section data-testid="comment-widget-general"><button>Sign in</button></section>');

    expect(await revealOriginalComments(document, { focusEditor: true })).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });

  it('waits for the site to render its comments', async () => {
    const { scrolls } = page();

    const revealed = revealOriginalComments(document, { timeoutMs: 1_000 });
    setTimeout(() => document.querySelector('main')!.insertAdjacentHTML('beforeend', WIDGET), 20);

    expect(await revealed).toBe(true);
    expect(scrolls).toHaveLength(1);
  });

  it('gives up after a while when the page has no comments section', async () => {
    const { scrolls } = page();

    expect(await revealOriginalComments(document, { timeoutMs: 50 })).toBe(false);
    expect(scrolls).toHaveLength(0);
  });
});
