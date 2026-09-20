import { fireEvent, render } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';

const ICON = 'https://cdn.mobalytics.gg/assets/poe-2/images/game/Art/2DItems/Rings/AmethystRing.avif';

describe('Icon', () => {
  it('shows the picture it was given', () => {
    const { container } = render(<Icon src={ICON} class="item-slot__icon" />);

    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(ICON);
    expect(img.classList.contains('item-slot__icon')).toBe(true);
  });

  // The site's CDN drops files now and then; the browser's broken-image mark looks like a bug in the guide.
  it('leaves an empty box where a picture the browser could not load would be', () => {
    const { container } = render(<Icon src={ICON} class="item-slot__icon" />);

    fireEvent.error(container.querySelector('img')!);

    expect(container.querySelector('img')).toBeNull();
    const box = container.querySelector('.item-slot__icon')!;
    expect(box.classList.contains('icon--missing')).toBe(true);
  });

  it('leaves the same box for an entity that has no picture at all', () => {
    const { container } = render(<Icon src={null} class="gem-socket" />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.gem-socket.icon--missing')).not.toBeNull();
  });

  it('can step aside entirely, for pictures that are decoration rather than a slot', () => {
    const { container } = render(<Icon src={ICON} class="build-header__art" missing="none" />);

    fireEvent.error(container.querySelector('img')!);

    expect(container.innerHTML).toBe('');
  });
});
