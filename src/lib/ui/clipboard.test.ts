import { describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

describe('copyText', () => {
  it('puts the text on the clipboard', async () => {
    const writeText = vi.fn(async () => {});

    expect(await copyText('Essence Drain', { clipboard: { writeText } })).toBe(true);
    expect(writeText).toHaveBeenCalledWith('Essence Drain');
  });

  // The page may hold the focus, and then the browser refuses the clipboard API.
  it('falls back to the editor command when the clipboard is refused', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('Document is not focused');
    });
    const exec = vi.fn(() => true);

    expect(await copyText('Chain II', { clipboard: { writeText }, exec })).toBe(true);
    expect(exec).toHaveBeenCalled();
  });

  it('says so when it could not copy at all', async () => {
    expect(await copyText('Chain II', { clipboard: null, exec: () => false })).toBe(false);
  });
});
