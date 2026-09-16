import { act, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TooltipModel } from '@/lib/tooltip/tooltip-model';
import { TooltipProvider, WithTooltip } from './Tooltip';

const MODEL: TooltipModel = {
  title: "Atziri's Disdain",
  subtitle: 'Helmets',
  iconUrl: 'https://cdn/atziri.webp',
  accent: 'unique',
  tags: ['Spell', 'AoE'],
  stats: [{ name: 'Energy Shield', value: '62' }],
  requirements: 'Level 40, Intelligence 58',
  description: 'A crown of thorns.',
  sections: [
    { title: null, lines: ['+(60-100) to maximum Mana'], tone: 'mod' },
    { title: 'Sockets', lines: ['Idol of Egrin'], tone: 'muted' },
  ],
  note: 'Modifier values are ranges',
  flavour: 'They screamed her name',
  corrupted: true,
};

function renderTrigger(model: TooltipModel | null = MODEL) {
  return render(
    <TooltipProvider>
      <p>
        Wear <WithTooltip model={model}>Atziri</WithTooltip> for ES.
      </p>
    </TooltipProvider>,
  );
}

const trigger = () => screen.getByText('Atziri');

describe('WithTooltip', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the tooltip after a short hover delay', () => {
    renderTrigger();

    fireEvent.pointerOver(trigger());
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(60);
    });
    const tooltip = screen.getByRole('tooltip');
    expect(trigger().getAttribute('aria-describedby')).toBe(tooltip.id);
  });

  it('renders everything the model describes', () => {
    renderTrigger();
    fireEvent.focus(trigger());

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.classList.contains('tooltip--unique')).toBe(true);
    expect(tooltip.querySelector('img')?.getAttribute('src')).toBe('https://cdn/atziri.webp');
    for (const text of [
      "Atziri's Disdain",
      'Helmets',
      'Spell',
      'AoE',
      'Energy Shield',
      '62',
      'Requires: Level 40, Intelligence 58',
      'A crown of thorns.',
      '+(60-100) to maximum Mana',
      'Sockets',
      'Idol of Egrin',
      'Modifier values are ranges',
      'They screamed her name',
      'Corrupted',
    ]) {
      expect(tooltip.textContent).toContain(text);
    }
  });

  it('does not open when the pointer leaves before the delay', () => {
    renderTrigger();

    fireEvent.pointerOver(trigger());
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.pointerLeave(trigger());
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('closes when the pointer leaves', () => {
    renderTrigger();
    fireEvent.pointerOver(trigger());
    act(() => {
      vi.advanceTimersByTime(200);
    });

    fireEvent.pointerLeave(trigger());

    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(trigger().hasAttribute('aria-describedby')).toBe(false);
  });

  it('opens immediately on keyboard focus and closes on blur or Escape', () => {
    renderTrigger();

    expect(trigger().getAttribute('tabindex')).toBe('0');
    fireEvent.focus(trigger());
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.keyDown(trigger(), { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.focus(trigger());
    fireEvent.blur(trigger());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('closes when something scrolls', () => {
    renderTrigger();
    fireEvent.focus(trigger());

    fireEvent.scroll(document);

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('positions the tooltip next to the trigger', () => {
    renderTrigger();
    vi.spyOn(trigger(), 'getBoundingClientRect').mockReturnValue({ left: 100, top: 100, right: 160, bottom: 120, width: 60, height: 20, x: 100, y: 100, toJSON: () => ({}) });

    fireEvent.focus(trigger());

    const style = screen.getByRole('tooltip').style;
    expect([style.left, style.top]).toEqual(['100px', '128px']);
  });

  it('lets a nested trigger take over and hands the tooltip back when the pointer returns', () => {
    const rune = { ...MODEL, title: 'Idol of Egrin', subtitle: 'Socketable' };
    render(
      <TooltipProvider>
        <WithTooltip model={MODEL}>
          <span>Item card</span>
          <WithTooltip model={rune}>
            <img alt="rune" />
          </WithTooltip>
        </WithTooltip>
      </TooltipProvider>,
    );
    const title = () => screen.queryByRole('tooltip')?.querySelector('.tooltip__title')?.textContent;

    fireEvent.pointerOver(screen.getByText('Item card'));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(title()).toBe("Atziri's Disdain");

    const runeImage = screen.getByAltText('rune');
    fireEvent.pointerOver(runeImage);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(title()).toBe('Idol of Egrin');

    fireEvent.pointerLeave(runeImage.parentElement!);
    fireEvent.pointerOver(screen.getByText('Item card'));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(title()).toBe("Atziri's Disdain");
  });

  it("renders above the guide's overlay, so the embedded site tree can't cover it", () => {
    const { container } = render(
      <div class="overlay">
        <TooltipProvider>
          <WithTooltip model={MODEL}>Atziri</WithTooltip>
        </TooltipProvider>
      </div>,
    );

    fireEvent.focus(trigger());

    const tooltip = screen.getByRole('tooltip');
    expect(container.querySelector('.overlay')?.contains(tooltip)).toBe(false);
    expect(container.contains(tooltip)).toBe(true);
  });

  it('renders just the content without a model', () => {
    const { container } = renderTrigger(null);

    expect(container.querySelector('p')?.textContent).toBe('Wear Atziri for ES.');
    expect(container.querySelector('[tabindex]')).toBeNull();
  });
});
