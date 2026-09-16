/** Narrowing helpers for reading untyped site data defensively. */

export type Obj = Record<string, unknown>;

export function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function obj(value: unknown): Obj | null {
  return isObj(value) ? value : null;
}

export function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Non-empty string or null. */
export function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Non-empty strings of an array; anything else is skipped. */
export function strings(value: unknown): string[] {
  return arr(value).filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function objs(value: unknown): Obj[] {
  return arr(value).filter(isObj);
}
