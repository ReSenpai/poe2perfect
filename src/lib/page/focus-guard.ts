/** Marks page elements (the site's tree laid over the guide) that keyboard focus may reach while the guide is shown. */
export const FOCUS_ALLOWED_ATTRIBUTE = 'data-poe2-build-guide-tree';

const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

/**
 * Keeps keyboard focus inside the guide while it covers the page: focus that tabs out onto the hidden site wraps
 * back to the guide's first control (or its last one when tabbing backwards).
 */
export function guardFocus({ doc, host, isActive }: { doc: Document; host: HTMLElement; isActive: () => boolean }): () => void {
  let backwards = false;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab') backwards = event.shiftKey;
  };

  const onFocusIn = (event: FocusEvent) => {
    const target = event.target;
    if (!isActive() || !(target instanceof Element)) return;
    // Focus inside the shadow root is retargeted to the host.
    if (target === host || host.contains(target) || target.closest(`[${FOCUS_ALLOWED_ATTRIBUTE}]`)) return;

    const controls = [...(host.shadowRoot ?? host).querySelectorAll<HTMLElement>(TABBABLE)].filter((element) => element.tabIndex >= 0);
    const next = backwards ? controls.at(-1) : controls[0];
    next?.focus();
  };

  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('focusin', onFocusIn, true);
  return () => {
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('focusin', onFocusIn, true);
  };
}
