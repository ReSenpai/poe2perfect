import { describe, expect, it } from 'vitest';
import { FONT_FAMILY, registerFonts } from './fonts';

class FakeFontFace {
  constructor(
    readonly family: string,
    readonly source: ArrayBuffer,
    readonly descriptors: FontFaceDescriptors,
  ) {}
}

function fakeFontSet() {
  const faces: FakeFontFace[] = [];
  return { faces, add: (face: FontFace) => faces.push(face as unknown as FakeFontFace) };
}

const SOURCES = [
  { dataUrl: `data:font/woff2;base64,${btoa('latin')}`, unicodeRange: 'U+0000-00FF' },
  { dataUrl: `data:font/woff2;base64,${btoa('cyr')}`, unicodeRange: 'U+0400-045F' },
];

describe('registerFonts', () => {
  it('adds each bundled subset as a variable-weight font face, without fetching', () => {
    const fontSet = fakeFontSet();

    registerFonts({ fontSet, FontFace: FakeFontFace as unknown as typeof FontFace, sources: SOURCES });

    expect(fontSet.faces.map((face) => [face.family, new TextDecoder().decode(face.source), face.descriptors])).toEqual([
      [FONT_FAMILY, 'latin', { weight: '100 900', style: 'normal', display: 'swap', unicodeRange: 'U+0000-00FF' }],
      [FONT_FAMILY, 'cyr', { weight: '100 900', style: 'normal', display: 'swap', unicodeRange: 'U+0400-045F' }],
    ]);
  });

  it('registers a source under its own family when it names one, e.g. the reading font', () => {
    const fontSet = fakeFontSet();

    registerFonts({
      fontSet,
      FontFace: FakeFontFace as unknown as typeof FontFace,
      sources: [...SOURCES, { family: 'PoE2 Guide Noto Sans', dataUrl: `data:font/woff2;base64,${btoa('noto')}`, unicodeRange: 'U+0000-00FF' }],
    });

    expect(fontSet.faces.map((face) => face.family)).toEqual([FONT_FAMILY, FONT_FAMILY, 'PoE2 Guide Noto Sans']);
  });

  it('registers once per font set', () => {
    const fontSet = fakeFontSet();
    const options = { fontSet, FontFace: FakeFontFace as unknown as typeof FontFace, sources: SOURCES };

    registerFonts(options);
    registerFonts(options);

    expect(fontSet.faces).toHaveLength(2);
  });

  it('uses a family name the page cannot collide with', () => {
    expect(FONT_FAMILY).not.toBe('Inter');
  });
});
