import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { guardFocus } from './focus-guard';

let host: HTMLElement;
let first: HTMLButtonElement;
let last: HTMLButtonElement;
let pageLink: HTMLAnchorElement;
let treeButton: HTMLButtonElement;
let active: boolean;
let stop: () => void;

const pressTab = (shiftKey = false) => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true }));

describe('guardFocus', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <a href="/elsewhere" class="page-link">Site link</a>
      <div data-poe2-build-guide-tree><button class="tree-button">+</button></div>
      <poe2-build-guide></poe2-build-guide>`;
    host = document.querySelector('poe2-build-guide')!;
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <div class="overlay">
        <button class="first">Overview</button>
        <button tabindex="-1">Skills</button>
        <button disabled>Nothing</button>
        <button class="last">Show original page</button>
      </div>`;
    first = root.querySelector('.first')!;
    last = root.querySelector('.last')!;
    pageLink = document.querySelector('.page-link')!;
    treeButton = document.querySelector('.tree-button')!;
    active = true;
    stop = guardFocus({ doc: document, host, isActive: () => active });
  });

  afterEach(() => stop());

  it('brings focus that tabs out of the guide back to its first control', () => {
    last.focus();
    pressTab();
    pageLink.focus();

    expect(host.shadowRoot!.activeElement).toBe(first);
  });

  it('wraps to the last control when tabbing backwards out of the guide', () => {
    first.focus();
    pressTab(true);
    pageLink.focus();

    expect(host.shadowRoot!.activeElement).toBe(last);
  });

  it("lets focus into the site's tree laid over the guide", () => {
    treeButton.focus();

    expect(document.activeElement).toBe(treeButton);
  });

  it('leaves focus alone while the original page is shown', () => {
    active = false;
    pageLink.focus();

    expect(document.activeElement).toBe(pageLink);
  });

  it('stops guarding when stopped', () => {
    stop();
    pageLink.focus();

    expect(document.activeElement).toBe(pageLink);
  });
});
