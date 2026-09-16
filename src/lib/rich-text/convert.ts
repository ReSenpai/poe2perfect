/** Safe, typed rich text tree built from a Lexical editor state. */

import { type Obj, arr, isObj, num, obj, str } from '@/lib/data/coerce';

export type EntityGroup = 'skill' | 'support' | 'passive' | 'item' | 'socketable' | 'other';

export interface RichTextRun {
  kind: 'text';
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  code: boolean;
  color: string | null;
}

export interface RichEntity {
  kind: 'entity';
  slug: string;
  label: string;
  iconUrl: string | null;
  group: EntityGroup;
}

export interface RichLink {
  kind: 'link';
  href: string;
  children: RichInline[];
}

export type RichInline = RichTextRun | RichEntity | RichLink | { kind: 'linebreak' };

export interface RichList {
  kind: 'list';
  ordered: boolean;
  start: number;
  items: { children: RichInline[]; lists: RichList[] }[];
}

export type RichBlock = { kind: 'paragraph'; children: RichInline[] } | { kind: 'heading'; level: 2 | 3 | 4; children: RichInline[] } | RichList;

const SITE_ORIGIN = 'https://mobalytics.gg';

// Lexical TextNode format bits.
const BOLD = 1;
const ITALIC = 2;
const STRIKETHROUGH = 4;
const UNDERLINE = 8;
const CODE = 16;

const ENTITY_GROUPS: Record<string, EntityGroup> = {
  activeSkillGems: 'skill',
  supportSkillGems: 'support',
  passiveSkills: 'passive',
  armours: 'item',
  weapons: 'item',
  rings: 'item',
  amulets: 'item',
  belts: 'item',
  focuses: 'item',
  shields: 'item',
  quivers: 'item',
  flasks: 'item',
  jewels: 'item',
  soulCores: 'socketable',
};

const HEADING_LEVELS: Record<string, 2 | 3 | 4> = { h1: 2, h2: 2, h3: 3, h4: 4, h5: 4, h6: 4 };

/**
 * Converts Lexical JSON into blocks the UI can render without HTML injection: only known
 * node kinds survive, links are limited to http(s), colours to hex values.
 */
export function toRichBlocks(value: unknown): RichBlock[] {
  return arr(obj(obj(value)?.root)?.children).flatMap(toBlocks);
}

function toBlocks(node: unknown): RichBlock[] {
  if (!isObj(node)) return [];
  switch (node.type) {
    case 'paragraph':
      return paragraph(inlines(node.children));
    case 'heading': {
      const children = inlines(node.children);
      return hasContent(children) ? [{ kind: 'heading', level: HEADING_LEVELS[str(node.tag) ?? ''] ?? 3, children }] : [];
    }
    case 'list':
      return [list(node)];
    default:
      // Unknown containers (quote, collapsible…) degrade to a paragraph; unknown leaves are skipped.
      return Array.isArray(node.children) ? paragraph(inlines(node.children)) : [];
  }
}

function paragraph(children: RichInline[]): RichBlock[] {
  return hasContent(children) ? [{ kind: 'paragraph', children }] : [];
}

function list(node: Obj): RichList {
  return {
    kind: 'list',
    ordered: node.listType === 'number',
    start: num(node.start) ?? 1,
    items: arr(node.children)
      .filter((item): item is Obj => isObj(item) && item.type === 'listitem')
      .map((item) => {
        const children = arr(item.children);
        return {
          children: inlines(children.filter((child) => !(isObj(child) && child.type === 'list'))),
          lists: children.filter((child): child is Obj => isObj(child) && child.type === 'list').map(list),
        };
      }),
  };
}

function inlines(nodes: unknown): RichInline[] {
  return arr(nodes).flatMap(toInlines);
}

function toInlines(node: unknown): RichInline[] {
  if (!isObj(node)) return [];
  switch (node.type) {
    case 'text':
      return typeof node.text === 'string' && node.text.length > 0 ? [textRun(node)] : [];
    case 'linebreak':
      return [{ kind: 'linebreak' }];
    case 'static-data-widget': {
      const slug = str(node.id);
      const label = str(node.label);
      if (!slug || !label) return [];
      return [{ kind: 'entity', slug, label, iconUrl: safeHttpsUrl(node.icon), group: ENTITY_GROUPS[str(node.groupId) ?? ''] ?? 'other' }];
    }
    case 'link':
    case 'autolink': {
      const children = inlines(node.children);
      const href = safeHref(node.url);
      return href ? [{ kind: 'link', href, children }] : children;
    }
    default:
      return Array.isArray(node.children) ? inlines(node.children) : [];
  }
}

function textRun(node: Obj): RichTextRun {
  const format = num(node.format) ?? 0;
  return {
    kind: 'text',
    text: node.text as string,
    bold: (format & BOLD) !== 0,
    italic: (format & ITALIC) !== 0,
    underline: (format & UNDERLINE) !== 0,
    strikethrough: (format & STRIKETHROUGH) !== 0,
    code: (format & CODE) !== 0,
    color: hexColor(node.style),
  };
}

function hasContent(children: RichInline[]): boolean {
  return children.some((child) => (child.kind === 'text' ? child.text.trim().length > 0 : child.kind !== 'linebreak'));
}

const COLOR_DECLARATION = /^\s*color\s*:\s*(#[0-9a-f]{3}|#[0-9a-f]{6})\s*;?\s*$/i;

/** Only a lone `color: #hex` declaration is honoured. */
function hexColor(style: unknown): string | null {
  return typeof style === 'string' ? (COLOR_DECLARATION.exec(style)?.[1]?.toLowerCase() ?? null) : null;
}

function safeHref(url: unknown): string | null {
  const value = str(url);
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return `${SITE_ORIGIN}${value}`;
  return /^https?:\/\//i.test(value) ? value : null;
}

function safeHttpsUrl(url: unknown): string | null {
  const value = str(url);
  return value && /^https:\/\//i.test(value) ? value : null;
}
