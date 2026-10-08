import { describe, expect, it } from 'vitest';
import { toRichBlocks } from '@/lib/rich-text/convert';
import { textToLexical } from './lexical';

const paragraph = (text?: string) => ({
  type: 'paragraph',
  version: 1,
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  children: text === undefined ? [] : [{ type: 'text', version: 1, text, detail: 0, format: 0, mode: 'normal', style: '' }],
});

describe('textToLexical', () => {
  it("writes plain text the way the site's comment editor does: one paragraph per line", () => {
    expect(textToLexical('Thanks for the guide!\nWhich ring first?')).toEqual({
      root: { type: 'root', version: 1, direction: 'ltr', format: '', indent: 0, children: [paragraph('Thanks for the guide!'), paragraph('Which ring first?')] },
    });
  });

  it('keeps blank lines between paragraphs as empty paragraphs and trims the edges', () => {
    expect(textToLexical('\n  One\n\nTwo  \n\n').root.children).toEqual([paragraph('One'), paragraph(), paragraph('Two')]);
  });

  it('reads back as the same text', () => {
    const blocks = toRichBlocks(textToLexical('a <b>bold</b> claim'));
    expect(blocks).toEqual([{ kind: 'paragraph', children: [expect.objectContaining({ kind: 'text', text: 'a <b>bold</b> claim', bold: false })] }]);
  });
});
