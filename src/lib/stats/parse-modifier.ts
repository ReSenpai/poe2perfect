/** How a number joins the others: added to a total, or scaling it. */
export type StatKind = 'flat' | 'increased' | 'more';

export interface StatValue {
  /** What the number is about, e.g. "Maximum Life", "Fire Resistance". */
  stat: string;
  kind: StatKind;
  /** The middle of the roll; the same as min and max when the value is fixed. */
  value: number;
  min: number;
  max: number;
  percent: boolean;
}

const NUMBER = String.raw`\d+(?:\.\d+)?`;
/** A rolled value the site writes as a range, e.g. "(7-13)". */
const AMOUNT = String.raw`(?:\((${NUMBER})-(${NUMBER})\)|(${NUMBER}))`;

const ADDED = new RegExp(String.raw`^\+?${AMOUNT}(%?)\s+to\s+(.+)$`, 'i');
const SCALED = new RegExp(String.raw`^${AMOUNT}(%?)\s+(increased|reduced|more|less)\s+(.+)$`, 'i');
const ADDS = new RegExp(String.raw`^Adds\s+${AMOUNT}\s+to\s+${AMOUNT}\s+(.+)$`, 'i');
const ANY_NUMBER = new RegExp(String.raw`\(${NUMBER}-${NUMBER}\)|${NUMBER}`);

/**
 * Turns a line of game text into the number it carries, so a spreadsheet can add it up.
 * Wording the game uses often is read as a named stat; anything else keeps its own wording as the name.
 */
export function parseModifier(line: string): StatValue[] {
  const text = line.trim();
  if (!text || /^Grants Skill:/i.test(text)) return [];

  const adds = ADDS.exec(text);
  if (adds) {
    const [low] = amount(adds[1], adds[2], adds[3]);
    const [, high] = amount(adds[4], adds[5], adds[6]);
    return [stat(`Adds ${adds[7]!}`, 'flat', low, high, false)];
  }

  const scaled = SCALED.exec(text);
  if (scaled) {
    const [low, high] = amount(scaled[1], scaled[2], scaled[3]);
    const word = scaled[5]!.toLowerCase();
    const away = word === 'reduced' || word === 'less';
    const kind = word === 'more' || word === 'less' ? 'more' : 'increased';
    return [stat(scaled[6]!, kind, away ? -high : low, away ? -low : high, scaled[4] === '%' || kind !== 'flat')];
  }

  const added = ADDED.exec(text);
  if (added) {
    const [low, high] = amount(added[1], added[2], added[3]);
    return [stat(added[5]!, 'flat', low, high, added[4] === '%')];
  }

  const loose = ANY_NUMBER.exec(text);
  if (!loose) return [];
  const [low, high] = loose[0].startsWith('(') ? rangeOf(loose[0]) : [Number(loose[0]), Number(loose[0])];
  return [stat(text.replace(ANY_NUMBER, '#'), 'flat', low, high, false)];
}

function amount(low: string | undefined, high: string | undefined, single: string | undefined): [number, number] {
  return low !== undefined && high !== undefined ? [Number(low), Number(high)] : [Number(single), Number(single)];
}

function rangeOf(text: string): [number, number] {
  const [low, high] = text.slice(1, -1).split('-');
  return [Number(low), Number(high)];
}

function stat(name: string, kind: StatKind, min: number, max: number, percent: boolean): StatValue {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  return {
    stat: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
    kind,
    value: round((min + max) / 2),
    min: round(min),
    max: round(max),
    percent,
  };
}

const round = (value: number) => Math.round(value * 100) / 100;
