export interface CopyDeps {
  clipboard?: { writeText(text: string): Promise<void> } | null;
  /** Last resort for when the clipboard API is refused, e.g. because the page holds the focus. */
  exec?: (text: string) => boolean;
}

/** Copies text, telling the caller whether it worked, so the UI can say so. */
export async function copyText(text: string, deps: CopyDeps = {}): Promise<boolean> {
  const { clipboard = globalThis.navigator?.clipboard ?? null, exec = execCopy } = deps;

  if (clipboard) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the editor command.
    }
  }

  try {
    return exec(text);
  } catch {
    return false;
  }
}

/** Works where the clipboard API is refused: a hidden field, selected and copied the old way. */
function execCopy(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('aria-hidden', 'true');
  field.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.append(field);
  field.select();
  try {
    return document.execCommand('copy');
  } finally {
    field.remove();
  }
}
