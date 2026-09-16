import { describe, expect, it } from 'vitest';
import { richTextSummary } from './summary';

const doc = (...children: unknown[]) => ({ root: { children } });
const paragraph = (...children: unknown[]) => ({ type: 'paragraph', children });
const text = (value: string) => ({ type: 'text', text: value });
const chip = (label: string) => ({ type: 'static-data-widget', id: label.toLowerCase(), label, groupId: 'activeSkillGems' });

describe('richTextSummary', () => {
  it('takes the plain text of the first paragraph, including entity names and links', () => {
    const value = doc(
      { type: 'heading', tag: 'h3', children: [text('Overview:')] },
      paragraph(text('Uses '), chip('Contagion'), text(' to  spread,'), { type: 'linebreak' }, { type: 'link', url: 'https://x.io', children: [text('see video')] }),
      paragraph(text('Second paragraph')),
    );

    expect(richTextSummary(value)).toBe('Uses Contagion to spread, see video');
  });

  it('shortens long text at a word boundary', () => {
    const value = doc(paragraph(text('This Build is an Endgame Setup for the Lich Ascendancy and one of the best League Starters')));

    expect(richTextSummary(value, 40)).toBe('This Build is an Endgame Setup for the…');
  });

  it('uses a list when there is no paragraph', () => {
    const value = doc({ type: 'list', listType: 'bullet', children: [{ type: 'listitem', children: [text('Tanky')] }, { type: 'listitem', children: [text('Fast')] }] });

    expect(richTextSummary(value)).toBe('Tanky');
  });

  it('is null without text', () => {
    expect(richTextSummary(null)).toBeNull();
    expect(richTextSummary(doc(paragraph(text('   '))))).toBeNull();
  });
});
