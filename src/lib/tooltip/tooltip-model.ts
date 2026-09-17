import type { EntityInfo, Gem, Item, NameValue, Passive, PassiveKind, Socketable } from '@/lib/build/model';

export type TooltipAccent =
  | 'unique'
  | 'rare'
  | 'magic'
  | 'normal'
  | 'gem'
  | 'gem-str'
  | 'gem-dex'
  | 'gem-int'
  | 'keystone'
  | 'notable'
  | 'ascendancy'
  | 'passive'
  | 'socketable';

export interface TooltipSection {
  title: string | null;
  lines: string[];
  tone: 'mod' | 'effect' | 'muted' | 'implicit';
}

/** Everything a tooltip shows, independent of the kind of entity it describes. */
export interface TooltipModel {
  title: string;
  subtitle: string | null;
  iconUrl: string | null;
  accent: TooltipAccent;
  tags: string[];
  stats: NameValue[];
  requirements: string | null;
  description: string | null;
  sections: TooltipSection[];
  note: string | null;
  flavour: string | null;
  corrupted: boolean;
}

const EMPTY: Omit<TooltipModel, 'title' | 'accent'> = {
  subtitle: null,
  iconUrl: null,
  tags: [],
  stats: [],
  requirements: null,
  description: null,
  sections: [],
  note: null,
  flavour: null,
  corrupted: false,
};

export function itemTooltip(item: Item, socketables: Socketable[] = []): TooltipModel {
  // Socketables list names only: their effects differ per item type and have their own tooltips.
  const socketLines = socketables.map((s) => s.name ?? s.slug);
  return {
    ...EMPTY,
    title: item.name,
    subtitle: item.itemClassName,
    iconUrl: item.iconUrl,
    accent: item.rarity,
    stats: item.properties,
    requirements: joinRequirements(item.requirements),
    sections: [
      section('Grants Skill', item.grantedSkills.map((skill) => (skill.level ? `Level ${skill.level} ${skill.name}` : skill.name)), 'effect'),
      section(null, item.implicits, 'implicit'),
      section(null, item.modifiers, 'mod'),
      section('Sockets', socketLines, 'muted'),
    ].filter(isPresent),
    note: item.modifiersSource === 'static' || item.modifiersSource === 'affixes' ? 'Modifier values are ranges' : null,
    flavour: item.flavourText,
    corrupted: item.corrupted,
  };
}

export function gemTooltip(gem: Gem): TooltipModel {
  const details = gem.details;
  return {
    ...EMPTY,
    title: gem.name,
    subtitle: gem.kind === 'support' ? 'Support Gem' : 'Skill Gem',
    iconUrl: gem.iconUrl,
    accent: gemAccent(gem),
    tags: details?.tags ?? [],
    stats: details?.stats ?? [],
    requirements: joinRequirements(details?.requirements ?? []),
    description: details?.description ?? null,
    sections: [
      section(null, details?.effects ?? [], 'effect'),
      section('Additional Effects From Quality', details?.qualityEffects ?? [], 'muted'),
    ].filter(isPresent),
  };
}

const PASSIVE_LABELS: Record<PassiveKind, string> = {
  keystone: 'Keystone',
  notable: 'Notable',
  ascendancy: 'Ascendancy',
  small: 'Passive',
  'jewel-socket': 'Jewel Socket',
};

export function passiveTooltip(passive: Passive): TooltipModel {
  const accent: TooltipAccent = passive.kind === 'small' || passive.kind === 'jewel-socket' ? 'passive' : passive.kind;
  return {
    ...EMPTY,
    title: passive.name,
    subtitle: PASSIVE_LABELS[passive.kind],
    iconUrl: passive.iconUrl,
    accent,
    sections: [section(null, passive.effects, 'effect')].filter(isPresent),
    flavour: passive.flavourText,
  };
}

export function socketableTooltip(socketable: Socketable): TooltipModel {
  return {
    ...EMPTY,
    title: socketable.name ?? socketable.slug,
    subtitle: 'Socketable',
    iconUrl: socketable.iconUrl,
    accent: 'socketable',
    sections: [section(null, socketable.effects, 'effect')].filter(isPresent),
  };
}

export function entityTooltip(info: EntityInfo): TooltipModel {
  switch (info.kind) {
    case 'item':
      return itemTooltip(info.item);
    case 'gem':
      return gemTooltip(info.gem);
    case 'passive':
      return passiveTooltip(info.passive);
    case 'socketable':
      return socketableTooltip(info.socketable);
  }
}

function gemAccent(gem: Gem): TooltipAccent {
  const attribute = gemAttribute(gem);
  return attribute ? `gem-${attribute}` : 'gem';
}

/** Dominant attribute of a gem (drives its colour); ties go to str, then dex. */
export function gemAttribute(gem: Gem): 'str' | 'dex' | 'int' | null {
  const { str = 0, dex = 0, int = 0 } = gem.details?.attributes ?? {};
  const top = Math.max(str, dex, int);
  if (top === 0) return null;
  return top === str ? 'str' : top === dex ? 'dex' : 'int';
}

function joinRequirements(requirements: NameValue[]): string | null {
  return requirements.length ? requirements.map(({ name, value }) => `${name} ${value}`).join(', ') : null;
}

/** Static descriptions pack several lines into one string with "\n". */
function splitLines(text: string): string[] {
  return text.split('\n').filter((line) => line.trim().length > 0);
}

function section(title: string | null, lines: string[], tone: TooltipSection['tone']): TooltipSection | null {
  const split = lines.flatMap(splitLines);
  return split.length ? { title, lines: split, tone } : null;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
