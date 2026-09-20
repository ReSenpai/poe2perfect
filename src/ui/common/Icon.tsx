import { useState } from 'preact/hooks';

export interface IconProps {
  src: string | null | undefined;
  class: string;
  alt?: string;
  /** What to leave behind when there is no picture: an empty box in its place, or nothing at all. */
  missing?: 'box' | 'none';
}

/**
 * A picture from the site's CDN. The CDN drops files now and then, and plenty of entities have no icon at all, so a
 * picture that does not arrive leaves an empty box rather than the browser's broken-image mark.
 */
export function Icon({ src, class: className, alt = '', missing = 'box' }: IconProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return missing === 'none' ? null : <span class={`${className} icon--missing`} aria-hidden="true" />;
  }

  return <img class={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}
