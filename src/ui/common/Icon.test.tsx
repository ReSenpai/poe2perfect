import { fireEvent, render, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Icon } from './Icon';

const ICON = 'https://cdn.mobalytics.gg/assets/poe-2/images/game/Art/2DItems/Rings/AmethystRing.avif';

describe('Icon', () => {
  it('shows the picture it was given', () => {
    const { container } = render(<Icon src={ICON} class="item-slot__icon" />);

    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(ICON);
    expect(img.classList.contains('item-slot__icon')).toBe(true);
  });

  // The site's CDN turns a share of requests away in bursts; the same file answers a moment later.
  it('asks again for a picture that did not arrive', async () => {
    const { container } = render(<Icon src={ICON} class="item-slot__icon" retryMs={[5]} />);

    fireEvent.error(container.querySelector('img')!);

    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).not.toBe(ICON));
    expect(container.querySelector('img')?.getAttribute('src')).toContain(ICON);
    expect(container.querySelector('.icon--missing')).toBeNull();
  });

  // The site's CDN drops files now and then; the browser's broken-image mark looks like a bug in the guide.
  it('leaves an empty box once the asking is done', async () => {
    const { container } = render(<Icon src={ICON} class="item-slot__icon" retryMs={[5]} />);

    fireEvent.error(container.querySelector('img')!);
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).not.toBe(ICON));
    fireEvent.error(container.querySelector('img')!);

    await waitFor(() => expect(container.querySelector('img')).toBeNull());
    const box = container.querySelector('.item-slot__icon')!;
    expect(box.classList.contains('icon--missing')).toBe(true);
  });

  it('leaves the same box for an entity that has no picture at all', () => {
    const { container } = render(<Icon src={null} class="gem-socket" />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.gem-socket.icon--missing')).not.toBeNull();
  });

  // An empty square reads as a fault; a shape that suits the slot reads as "no picture for this one".
  it('draws a shape in keeping with what is missing', () => {
    const { container } = render(<Icon src={null} class="item-slot__icon" kind="item" />);

    const box = container.querySelector('.icon--missing')!;
    expect(box.classList.contains('icon--item')).toBe(true);
    expect(box.querySelector('svg')).not.toBeNull();
  });

  it('tells a gem, a passive and a rune apart', () => {
    const kinds = [
      ['gem', 'icon--gem'],
      ['passive', 'icon--passive'],
      ['rune', 'icon--rune'],
    ] as const;

    for (const [kind, expected] of kinds) {
      const { container } = render(<Icon src={null} class="gem-socket" kind={kind} />);
      expect(container.querySelector('.icon--missing')!.classList.contains(expected)).toBe(true);
    }
  });

  it('can step aside entirely, for pictures that are decoration rather than a slot', async () => {
    const { container } = render(<Icon src={ICON} class="build-header__art" missing="none" retryMs={[]} />);

    fireEvent.error(container.querySelector('img')!);

    await waitFor(() => expect(container.innerHTML).toBe(''));
  });
});
