import { describe, expect, it } from 'vitest';
import { collectEntityLabels, toRichText } from './rich-text-data';

const paragraph = (...children: unknown[]) => ({ type: 'paragraph', children });
const text = (value: string) => ({ type: 'text', text: value });
const chip = (id: string, label: string) => ({ type: 'static-data-widget', id, label, groupId: 'supportSkillGems' });

describe('toRichText', () => {
  it('keeps an editor state with text', () => {
    const value = { root: { type: 'root', children: [paragraph(text('Hello'))] } };

    expect(toRichText(value)).toBe(value);
  });

  it('keeps an editor state with only an entity chip', () => {
    const value = { root: { children: [paragraph(chip('contagionplayer', 'Contagion'))] } };

    expect(toRichText(value)).toBe(value);
  });

  it.each([
    ['null', null],
    ['no root', { foo: 1 }],
    ['empty root', { root: { children: [] } }],
    ['blank paragraphs', { root: { children: [paragraph(), paragraph(text('   '))] } }],
  ])('drops %s', (_name, value) => {
    expect(toRichText(value)).toBeNull();
  });
});

describe('collectEntityLabels', () => {
  it('maps entity chip ids to labels anywhere in the value, first label wins', () => {
    const labels = collectEntityLabels({
      content: [
        { data: { simplifiedContent: { value: { root: { children: [paragraph(chip('supportchaosmasteryplayer', 'Chaos Mastery'))] } } } } },
        { data: { deep: [[paragraph(chip('supportchaosmasteryplayer', 'Other')), chip('passive-x', 'Heavy Buffer')]] } },
        { data: { root: { children: [chip('', 'No id'), { type: 'static-data-widget', id: 'no-label' }] } } },
      ],
    });

    expect([...labels]).toEqual([
      ['supportchaosmasteryplayer', 'Chaos Mastery'],
      ['passive-x', 'Heavy Buffer'],
    ]);
  });
});
