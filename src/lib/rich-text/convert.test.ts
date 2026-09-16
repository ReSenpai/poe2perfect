import { describe, expect, it } from 'vitest';
import { toRichBlocks } from './convert';

const doc = (...children: unknown[]) => ({ root: { type: 'root', children } });
const paragraph = (...children: unknown[]) => ({ type: 'paragraph', children });
const text = (value: string, format = 0, style = '') => ({ type: 'text', text: value, format, style, detail: 0, mode: 'normal' });
const plain = (value: string) => ({
  kind: 'text',
  text: value,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  code: false,
  color: null,
});

describe('toRichBlocks', () => {
  it('converts paragraphs of text', () => {
    expect(toRichBlocks(doc(paragraph(text('Hello '), text('world'))))).toEqual([
      { kind: 'paragraph', children: [plain('Hello '), plain('world')] },
    ]);
  });

  it('decodes the Lexical format bitmask', () => {
    const [block] = toRichBlocks(doc(paragraph(text('b', 1), text('i', 2), text('s', 4), text('u', 8), text('c', 16), text('bu', 9))));

    expect(block).toMatchObject({
      children: [
        { text: 'b', bold: true, italic: false },
        { text: 'i', italic: true },
        { text: 's', strikethrough: true },
        { text: 'u', underline: true },
        { text: 'c', code: true },
        { text: 'bu', bold: true, underline: true, italic: false },
      ],
    });
  });

  it('keeps only hex colours from inline styles', () => {
    const [block] = toRichBlocks(
      doc(
        paragraph(
          text('gold', 0, 'color: #ffdc7b;'),
          text('short', 0, 'color:#7af'),
          text('empty', 0, 'color: ;'),
          text('evil', 0, 'color: red; background: url(https://evil)'),
          text('var', 0, 'color: var(--x1sd21jv);'),
        ),
      ),
    );

    expect(block?.kind === 'paragraph' && block.children.map((node) => node.kind === 'text' && node.color)).toEqual(['#ffdc7b', '#7af', null, null, null]);
  });

  it('converts headings, clamping the level', () => {
    expect(toRichBlocks(doc({ type: 'heading', tag: 'h4', children: [text('Leveling')] }, { type: 'heading', tag: 'h1', children: [text('Top')] }, { type: 'heading', tag: 'bogus', children: [text('?')] }))).toEqual([
      { kind: 'heading', level: 4, children: [plain('Leveling')] },
      { kind: 'heading', level: 2, children: [plain('Top')] },
      { kind: 'heading', level: 3, children: [plain('?')] },
    ]);
  });

  it('converts bullet and numbered lists, including nested lists', () => {
    const list = {
      type: 'list',
      listType: 'number',
      tag: 'ol',
      start: 3,
      children: [
        { type: 'listitem', value: 3, children: [text('Wand')] },
        {
          type: 'listitem',
          value: 4,
          children: [{ type: 'list', listType: 'bullet', tag: 'ul', start: 1, children: [{ type: 'listitem', children: [text('Rune')] }] }],
        },
      ],
    };

    expect(toRichBlocks(doc(list))).toEqual([
      {
        kind: 'list',
        ordered: true,
        start: 3,
        items: [
          { children: [plain('Wand')], lists: [] },
          { children: [], lists: [{ kind: 'list', ordered: false, start: 1, items: [{ children: [plain('Rune')], lists: [] }] }] },
        ],
      },
    ]);
  });

  it('converts line breaks', () => {
    expect(toRichBlocks(doc(paragraph(text('a'), { type: 'linebreak' }, text('b'))))).toEqual([
      { kind: 'paragraph', children: [plain('a'), { kind: 'linebreak' }, plain('b')] },
    ]);
  });

  it('converts entity chips with their group', () => {
    const chip = (groupId: string, icon?: string) => ({
      type: 'static-data-widget',
      id: `${groupId}-slug`,
      label: 'Label',
      groupId,
      icon,
      color: 'var(--x1sd21jv)',
      iconStyle: 'square-rounded',
    });

    const [block] = toRichBlocks(
      doc(
        paragraph(
          chip('activeSkillGems', 'https://cdn.mobalytics.gg/Contagion.avif'),
          chip('supportSkillGems'),
          chip('passiveSkills'),
          chip('armours'),
          chip('weapons'),
          chip('soulCores'),
          chip('somethingNew', 'javascript:alert(1)'),
        ),
      ),
    );

    expect(block?.kind === 'paragraph' && block.children).toEqual([
      { kind: 'entity', slug: 'activeSkillGems-slug', label: 'Label', iconUrl: 'https://cdn.mobalytics.gg/Contagion.avif', group: 'skill' },
      { kind: 'entity', slug: 'supportSkillGems-slug', label: 'Label', iconUrl: null, group: 'support' },
      { kind: 'entity', slug: 'passiveSkills-slug', label: 'Label', iconUrl: null, group: 'passive' },
      { kind: 'entity', slug: 'armours-slug', label: 'Label', iconUrl: null, group: 'item' },
      { kind: 'entity', slug: 'weapons-slug', label: 'Label', iconUrl: null, group: 'item' },
      { kind: 'entity', slug: 'soulCores-slug', label: 'Label', iconUrl: null, group: 'socketable' },
      { kind: 'entity', slug: 'somethingNew-slug', label: 'Label', iconUrl: null, group: 'other' },
    ]);
  });

  it('drops an entity chip without a label', () => {
    expect(toRichBlocks(doc(paragraph({ type: 'static-data-widget', id: 'x', label: '' }, text('ok'))))).toEqual([{ kind: 'paragraph', children: [plain('ok')] }]);
  });

  it('keeps safe links, resolving site-relative ones', () => {
    const link = (url: string, label = url) => ({ type: 'link', url, target: '_blank', rel: 'ugc nofollow', children: [text(label)] });

    const [block] = toRichBlocks(
      doc(
        paragraph(
          link('https://youtu.be/BeC47X7M7Uw'),
          link('/poe-2/guides/poison', 'guide'),
          link('javascript:alert(1)', 'evil'),
          link('data:text/html,<script>', 'data'),
          link('//evil.example/x', 'protocol-relative'),
        ),
      ),
    );

    expect(block?.kind === 'paragraph' && block.children).toEqual([
      { kind: 'link', href: 'https://youtu.be/BeC47X7M7Uw', children: [plain('https://youtu.be/BeC47X7M7Uw')] },
      { kind: 'link', href: 'https://mobalytics.gg/poe-2/guides/poison', children: [plain('guide')] },
      plain('evil'),
      plain('data'),
      plain('protocol-relative'),
    ]);
  });

  it('keeps markup-like text as plain text', () => {
    expect(toRichBlocks(doc(paragraph(text('<img src=x onerror=alert(1)>'))))).toEqual([
      { kind: 'paragraph', children: [plain('<img src=x onerror=alert(1)>')] },
    ]);
  });

  it('unwraps unknown containers and skips unknown leaves', () => {
    expect(
      toRichBlocks(
        doc(
          { type: 'quote', children: [text('quoted'), { type: 'mystery-inline' }] },
          { type: 'horizontalrule' },
          paragraph({ type: 'mark', children: [text('marked')] }, { type: 'image', src: 'https://x' }),
        ),
      ),
    ).toEqual([
      { kind: 'paragraph', children: [plain('quoted')] },
      { kind: 'paragraph', children: [plain('marked')] },
    ]);
  });

  it('drops empty paragraphs', () => {
    expect(toRichBlocks(doc(paragraph(), paragraph(text('')), paragraph({ type: 'linebreak' }, text(' ')), paragraph(text('x'))))).toEqual([{ kind: 'paragraph', children: [plain('x')] }]);
  });

  it('returns nothing for a malformed value', () => {
    expect(toRichBlocks(null)).toEqual([]);
    expect(toRichBlocks({ root: 'nope' })).toEqual([]);
  });
});
