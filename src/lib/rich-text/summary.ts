import { type RichBlock, type RichInline, toRichBlocks } from './convert';

/** One-line plain text teaser: the first paragraph (or list item), shortened at a word boundary. */
export function richTextSummary(value: unknown, maxLength = 180): string | null {
  const first = toRichBlocks(value).map(blockText).find((line) => line.length > 0);
  if (!first) return null;
  if (first.length <= maxLength) return first;
  const cut = first.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

function blockText(block: RichBlock): string {
  if (block.kind === 'heading') return '';
  const inlines = block.kind === 'list' ? (block.items[0]?.children ?? []) : block.children;
  return inlines.map(inlineText).join('').replace(/\s+/g, ' ').trim();
}

function inlineText(node: RichInline): string {
  switch (node.kind) {
    case 'text':
      return node.text;
    case 'entity':
      return node.label;
    case 'link':
      return node.children.map(inlineText).join('');
    case 'linebreak':
      return ' ';
  }
}
