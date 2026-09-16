import { describe, expect, it } from 'vitest';
import { placeTooltip } from './placement';

const VIEWPORT = { width: 1200, height: 800 };

function anchor(left: number, top: number, width = 100, height = 20) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

describe('placeTooltip', () => {
  it('opens below the anchor, aligned to its left edge', () => {
    expect(placeTooltip({ anchor: anchor(100, 100), size: { width: 300, height: 200 }, viewport: VIEWPORT })).toEqual({ left: 100, top: 128, side: 'bottom' });
  });

  it('flips above when there is no room below', () => {
    expect(placeTooltip({ anchor: anchor(100, 700), size: { width: 300, height: 200 }, viewport: VIEWPORT })).toEqual({ left: 100, top: 492, side: 'top' });
  });

  it('stays inside the right edge', () => {
    expect(placeTooltip({ anchor: anchor(1100, 100), size: { width: 300, height: 200 }, viewport: VIEWPORT }).left).toBe(892);
  });

  it('stays inside the left edge', () => {
    expect(placeTooltip({ anchor: anchor(-50, 100), size: { width: 300, height: 200 }, viewport: VIEWPORT }).left).toBe(8);
  });

  it('moves a tooltip too tall for above or below to the right of the anchor', () => {
    expect(placeTooltip({ anchor: anchor(100, 400), size: { width: 300, height: 550 }, viewport: VIEWPORT })).toEqual({ left: 208, top: 242, side: 'right' });
  });

  it('uses the left side when there is no room on the right', () => {
    expect(placeTooltip({ anchor: anchor(800, 400), size: { width: 300, height: 550 }, viewport: VIEWPORT })).toEqual({ left: 492, top: 242, side: 'left' });
  });

  it('falls back to the roomier vertical side, clamped, when nothing fits', () => {
    const huge = { width: 1100, height: 700 };

    expect(placeTooltip({ anchor: anchor(100, 600), size: huge, viewport: VIEWPORT })).toEqual({ left: 92, top: 8, side: 'top' });
    expect(placeTooltip({ anchor: anchor(100, 150), size: huge, viewport: VIEWPORT })).toEqual({ left: 92, top: 92, side: 'bottom' });
  });

  it('pins to the margin when the tooltip is wider than the viewport', () => {
    expect(placeTooltip({ anchor: anchor(300, 100), size: { width: 1300, height: 100 }, viewport: VIEWPORT }).left).toBe(8);
  });
});
