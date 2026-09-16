import type { RawBuildDocument } from '@/lib/data/types';

const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ');

type Json = unknown;

/**
 * Dev tool: a build document safe to keep in a public repository. The guide's own wording becomes placeholder words
 * (keeping the text's shape: paragraphs, lists, entity chips, links), and other people's comments and builds go.
 * Build data (variants, items, skills, trees) and the guide author's name stay.
 */
export function scrubBuildDocument(doc: RawBuildDocument): RawBuildDocument {
  const copy = structuredClone(doc);
  let next = 0;

  const placeholder = (original: string) => {
    const [, lead = '', body = '', trail = ''] = /^(\s*)(.*?)(\s*)$/s.exec(original) ?? [];
    if (!body) return original;
    const words = body.split(/\s+/).map(() => WORDS[next++ % WORDS.length]!);
    if (/^\p{Lu}/u.test(body)) words[0] = words[0]!.charAt(0).toUpperCase() + words[0]!.slice(1);
    return lead + words.join(' ') + trail;
  };

  const scrubLexical = (node: Json) => {
    if (!node || typeof node !== 'object') return;
    const record = node as { type?: unknown; text?: unknown; children?: unknown };
    if (record.type === 'text' && typeof record.text === 'string') record.text = placeholder(record.text);
    if (Array.isArray(record.children)) record.children.forEach(scrubLexical);
  };

  const walk = (value: Json) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    const record = value as Record<string, unknown>;
    const root = record.root as { type?: unknown } | undefined;
    if (root && root.type === 'root') {
      scrubLexical(root);
      return;
    }
    Object.values(record).forEach(walk);
  };

  for (const widget of copy.content) {
    if (widget.__typename.includes('Comments')) widget.data.payload = null;
    if (widget.__typename.includes('Discovery')) widget.data.discovery = null;
  }
  walk(copy);
  return copy;
}
