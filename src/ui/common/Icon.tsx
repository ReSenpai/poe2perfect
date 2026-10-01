import { CircleDot, Diamond, FlaskConical, Gem, ImageOff, Package, Shield, Shirt, Sparkles, Swords } from 'lucide-preact';
import { useEffect, useState } from 'preact/hooks';

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
 * The site's CDN turns a share of requests away in bursts — a page can open with dozens of pictures missing while
 * the same files answer a moment later — so a picture that fails is asked for again before it is given up on.
 */
const RETRY_MS = [600, 2000];

export interface IconProps {
  src: string | null | undefined;
  class: string;
  alt?: string;
  kind?: IconKind;
  /** What to leave behind when there is no picture: a stand-in in its place, or nothing at all. */
  missing?: 'box' | 'none';
  /** How long to wait before each further attempt; injected in tests. */
  retryMs?: number[];
}

export function Icon({ src, class: className, alt = '', kind, missing = 'box', retryMs = RETRY_MS }: IconProps) {
  const [attempt, setAttempt] = useState(0);

  useEffect(() => setAttempt(0), [src]);

  if (!src || attempt > retryMs.length) {
    if (missing === 'none') return null;
    const Shape = kind ? STAND_IN[kind] : ImageOff;
    return (
      <span class={`${className} icon--missing${kind ? ` icon--${kind}` : ''}`} aria-hidden="true">
        <Shape />
      </span>
    );
  }

  // Each further attempt carries a mark of its own, so the browser asks the CDN again instead of reusing its answer.
  const source = attempt === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`;

  const askAgain = () => {
    const wait = retryMs[attempt];
    if (wait === undefined) {
      setAttempt(retryMs.length + 1);
      return;
    }
    setTimeout(() => setAttempt((n) => n + 1), wait);
  };

  return <img class={className} src={source} alt={alt} loading="lazy" onError={askAgain} />;
}
