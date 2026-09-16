import { isObj, str } from '@/lib/data/coerce';
import type { RichText } from './model';

const ENTITY_NODE = 'static-data-widget';

/** A Lexical editor state worth showing, or null when it's missing or has no visible content. */
export function toRichText(value: unknown): RichText | null {
  if (!isObj(value) || !isObj(value.root)) return null;
  return hasContent(value.root) ? (value as unknown as RichText) : null;
}

function hasContent(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasContent);
  if (!isObj(node)) return false;
  if (node.type === ENTITY_NODE) return true;
  if (node.type === 'text' && typeof node.text === 'string' && node.text.trim().length > 0) return true;
  return hasContent(node.children);
}

/** Names of game entities mentioned as chips in guide texts, by slug. */
export function collectEntityLabels(value: unknown): Map<string, string> {
  const labels = new Map<string, string>();
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
    } else if (isObj(node)) {
      const id = str(node.id);
      const label = str(node.label);
      if (node.type === ENTITY_NODE && id && label && !labels.has(id)) labels.set(id, label);
      Object.values(node).forEach(visit);
    }
  };
  visit(value);
  return labels;
}
