import { CircleDot, Diamond, FlaskConical, Gem, ImageOff, Package, Shield, Shirt, Sparkles, Swords } from 'lucide-preact';
import { useState } from 'preact/hooks';

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

export interface IconProps {
  src: string | null | undefined;
  class: string;
  alt?: string;
  kind?: IconKind;
  /** What to leave behind when there is no picture: a stand-in in its place, or nothing at all. */
  missing?: 'box' | 'none';
}

/**
 * A picture from the site's CDN. The CDN drops files now and then, and plenty of entities have no icon at all, so a
 * picture that does not arrive leaves a stand-in of the same size — an item, gem, passive or rune shape — rather
 * than the browser's broken-image mark.
 */
export function Icon({ src, class: className, alt = '', kind, missing = 'box' }: IconProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    if (missing === 'none') return null;
    const Shape = kind ? STAND_IN[kind] : ImageOff;
    return (
      <span class={`${className} icon--missing${kind ? ` icon--${kind}` : ''}`} aria-hidden="true">
        <Shape />
      </span>
    );
  }

  return <img class={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}
