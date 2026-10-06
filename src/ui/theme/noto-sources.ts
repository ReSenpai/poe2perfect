import cyrillic from '@fontsource-variable/noto-sans/files/noto-sans-cyrillic-wght-normal.woff2?inline';
import latin from '@fontsource-variable/noto-sans/files/noto-sans-latin-wght-normal.woff2?inline';
import type { FontSource } from './fonts';

/** The reading font for long texts such as comments; its own name, like the UI font, so the page can't shadow it. */
export const READING_FONT_FAMILY = 'PoE2 Guide Noto Sans';

// Unicode ranges from @fontsource-variable/noto-sans/wght.css.
export const NOTO_SOURCES: FontSource[] = [
  {
    family: READING_FONT_FAMILY,
    dataUrl: latin,
    unicodeRange:
      'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  },
  { family: READING_FONT_FAMILY, dataUrl: cyrillic, unicodeRange: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' },
];
