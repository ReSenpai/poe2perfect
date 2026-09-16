export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface Placement {
  left: number;
  top: number;
  side: 'top' | 'bottom' | 'left' | 'right';
}

const GAP = 8;
const MARGIN = 8;

/**
 * Fixed-position coordinates for a tooltip next to its anchor, never covering it when avoidable: below, above,
 * to the right, to the left; if nothing fits, the roomier of below/above. Always clamped inside the viewport.
 */
export function placeTooltip({
  anchor,
  size,
  viewport,
}: {
  anchor: Rect;
  size: { width: number; height: number };
  viewport: { width: number; height: number };
}): Placement {
  const below = anchor.bottom + GAP;
  const above = anchor.top - GAP - size.height;
  const roomBelow = viewport.height - MARGIN - below;
  const roomAbove = anchor.top - GAP - MARGIN;

  const sideTop = clamp(anchor.top, MARGIN, viewport.height - MARGIN - size.height);
  if (size.height > roomBelow && size.height > roomAbove) {
    if (size.width <= viewport.width - MARGIN - (anchor.right + GAP)) {
      return { left: anchor.right + GAP, top: sideTop, side: 'right' };
    }
    if (size.width <= anchor.left - GAP - MARGIN) {
      return { left: anchor.left - GAP - size.width, top: sideTop, side: 'left' };
    }
  }

  let side: 'top' | 'bottom';
  if (size.height <= roomBelow) side = 'bottom';
  else if (size.height <= roomAbove) side = 'top';
  else side = roomAbove > roomBelow ? 'top' : 'bottom';

  return {
    left: clamp(anchor.left, MARGIN, viewport.width - MARGIN - size.width),
    top: clamp(side === 'bottom' ? below : above, MARGIN, viewport.height - MARGIN - size.height),
    side,
  };
}

/** Like Math.min(Math.max(...)), but the lower bound wins when the range is empty. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
