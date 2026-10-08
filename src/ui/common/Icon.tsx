import { CircleDot, Diamond, FlaskConical, Gem, ImageOff, Package, Shield, Shirt, Sparkles, Swords } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';

/** What the picture would have shown, so its stand-in can suit the slot. */
export type IconKind = 'item' | 'armour' | 'weapon' | 'offhand' | 'jewellery' | 'flask' | 'charm' | 'gem' | 'passive' | 'rune';

const STAND_IN = {
  item: Package,
  armour: Shirt,
  weapon: Swords,
  offhand: Shield,
  jewellery: CircleDot,
  flask: FlaskConical,
  charm: Sparkles,
  gem: Gem,
  passive: Sparkles,
  rune: Diamond,
};

/**
 * Whether the browser has already given up on the picture — a cached refusal arrives before any handler is attached:
 * its load is over and there is no picture. A picture still on its way is not a refusal (Firefox turns `decode()`
 * down for one, which left a stand-in where the picture would have arrived).
 */
export const pictureRefused = (image: HTMLImageElement) => image.complete && image.naturalWidth === 0;

export interface IconProps {
  src: string | null | undefined;
  class: string;
  alt?: string;
  kind?: IconKind;
  /** What to leave behind when there is no picture: a stand-in in its place, or nothing at all. */
  missing?: 'box' | 'none';
  /** How a picture the browser has already given up on is told; injected in tests. */
  refused?: (image: HTMLImageElement) => boolean;
}

/**
 * A picture from the site's CDN. The CDN drops files now and then, and plenty of entities have no icon at all, so a
 * picture that does not arrive leaves a stand-in of the same size — an item, gem, passive or rune shape — rather
 * than the browser's broken-image mark.
 */
export function Icon({ src, class: className, alt = '', kind, missing = 'box', refused = pictureRefused }: IconProps) {
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement | null>(null);

  useEffect(() => setFailed(false), [src]);

  // A refusal the browser already holds arrives before the handler below is attached, so the picture is asked
  // about once it is on the page as well.
  useEffect(() => {
    const element = image.current;
    if (element && !failed && refused(element)) setFailed(true);
  }, [src, failed, refused]);

  if (!src || failed) {
    if (missing === 'none') return null;
    const Shape = kind ? STAND_IN[kind] : ImageOff;
    return (
      <span class={`${className} icon--missing${kind ? ` icon--${kind}` : ''}`} aria-hidden="true">
        <Shape />
      </span>
    );
  }

  // Not lazy: Firefox left lazy pictures in the overlay unloaded until the tab was drawn again, and the site's own
  // page has already put them in the browser's cache.
  return <img ref={image} class={className} src={src} alt={alt} onError={() => setFailed(true)} />;
}
