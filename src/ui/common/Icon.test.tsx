import { fireEvent, render, waitFor } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { Icon, pictureRefused } from './Icon';

const ICON = 'https://cdn.mobalytics.gg/assets/poe-2/images/game/Art/2DItems/Rings/AmethystRing.avif';

describe('Icon', () => {
  it('shows the picture it was given', () => {
    const { container } = render(<Icon src={ICON} class="item-slot__icon" />);

    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(ICON);
    expect(img.classList.contains('item-slot__icon')).toBe(true);
  });

  // The site's CDN drops files now and then; the browser's broken-image mark looks like a bug in the guide.
  it('puts a stand-in in place the moment a picture fails', () => {
    const { container } = render(<Icon src={ICON} class="item-slot__icon" />);

    fireEvent.error(container.querySelector('img')!);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.item-slot__icon.icon--missing')).not.toBeNull();
  });

  // A refusal the browser already holds arrives before any handler is attached, and the picture would sit broken.
  it('stands in for a picture the browser had already given up on', async () => {
    const { container } = render(<Icon src={ICON} class="item-slot__icon" refused={() => true} />);

    await waitFor(() => expect(container.querySelector('.item-slot__icon.icon--missing')).not.toBeNull());
  });

  it("keeps waiting for a picture still on its way: only a finished load with no picture is a refusal", () => {
    const image = (complete: boolean, naturalWidth: number) => ({ complete, naturalWidth }) as HTMLImageElement;

    expect(pictureRefused(image(false, 0))).toBe(false);
    expect(pictureRefused(image(true, 64))).toBe(false);
    expect(pictureRefused(image(true, 0))).toBe(true);
  });

  // Firefox left lazy pictures in the overlay unloaded until the tab was drawn again; the site has them cached anyway.
  it('loads the picture straight away rather than lazily', () => {
    const { container } = render(<Icon src={ICON} class="item-slot__icon" />);

    expect(container.querySelector('img')!.hasAttribute('loading')).toBe(false);
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

  it('can step aside entirely, for pictures that are decoration rather than a slot', () => {
    const { container } = render(<Icon src={ICON} class="build-header__art" missing="none" />);

    fireEvent.error(container.querySelector('img')!);

    expect(container.innerHTML).toBe('');
  });
});
