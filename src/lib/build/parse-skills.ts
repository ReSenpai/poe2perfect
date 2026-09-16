import { type Obj, num, obj, objs, str, strings } from '@/lib/data/coerce';
import type { Attributes, Gem, GemDetails, GemPriorityEntry, NameValue, Skill } from './model';
import type { StaticEntry, StaticIndex } from './static-index';

/** Entity names mentioned in guide texts, by slug. */
export type EntityLabels = ReadonlyMap<string, string>;

export function parseSkills(
  raw: unknown,
  index: StaticIndex,
  labels: EntityLabels = new Map(),
): { skills: Skill[]; gemRequirements: Attributes | null; gemPriority: GemPriorityEntry[] } {
  const skillGems = obj(raw);
  if (!skillGems) return { skills: [], gemRequirements: null, gemPriority: [] };

  const priorityNames = new Map<string, string>();
  for (const gem of objs(skillGems.priorityGems)) {
    const slug = str(gem.gemSlug);
    const name = str(gem.name);
    if (slug && name) priorityNames.set(slug, name);
  }

  const nameOf = (slug: string, own: unknown) =>
    str(own) ?? str(index.gem(slug)?.name) ?? priorityNames.get(slug) ?? labels.get(slug) ?? nameFromSlug(slug);

  const skills = objs(skillGems.gems).flatMap((entry): Skill[] => {
    const active = obj(entry.activeSkill);
    const slug = str(active?.gemSlug);
    if (!active || !slug) return [];

    const supports = objs(entry.subSkills).flatMap((sub): Gem[] => {
      const subSlug = str(sub.gemSlug);
      if (!subSlug) return [];
      return [gem(subSlug, nameOf(subSlug, null), str(sub.iconURL), sub.gemType === 'ACTIVE' ? 'active' : 'support', null, index)];
    });

    return [{ gem: gem(slug, nameOf(slug, active.name), str(active.iconURL), 'active', num(active.level), index), supports }];
  });

  const skillNames = new Map(skills.map((skill) => [skill.gem.slug, skill.gem.name]));
  const gemPriority = objs(skillGems.priorityGems).flatMap((entry): GemPriorityEntry[] => {
    const slug = str(entry.gemSlug);
    if (!slug) return [];
    const name = nameOf(slug, entry.name);
    const parentSlug = str(entry.parentActiveSkillGemSlug);
    const parentName = parentSlug
      ? (skillNames.get(parentSlug) ?? str(index.gem(parentSlug)?.name) ?? (parentSlug === slug ? name : null))
      : null;
    return [{ gem: gem(slug, name, str(entry.iconURL), entry.gemType === 'ACTIVE' ? 'active' : 'support', null, index), parentSlug, parentName }];
  });

  return { skills, gemRequirements: attributes(obj(skillGems.gemRequirements)), gemPriority };
}

/** A gem known only by slug (e.g. mentioned in guide text), described from static data. */
export function gemFromStatic(slug: string, index: StaticIndex): Gem | null {
  const entry = index.gem(slug);
  const name = str(entry?.name);
  return entry && name ? gem(slug, name, null, entry.isSupport === true ? 'support' : 'active', null, index) : null;
}

function gem(slug: string, name: string, iconUrl: string | null, kind: Gem['kind'], level: number | null, index: StaticIndex): Gem {
  const entry = index.gem(slug);
  return { slug, name, iconUrl: iconUrl ?? str(entry?.icon), kind, level, details: entry ? details(entry, level) : null };
}

function details(entry: StaticEntry, level: number | null): GemDetails {
  const atLevel = level === null ? null : obj(objs(entry.statsPerLevel)[level - 1]);
  return {
    description: str(entry.mainDescription),
    tags: objs(entry.gemsTags).flatMap((tag) => str(tag.backedName) ?? []),
    stats: atLevel && level !== null ? levelStats(level, atLevel) : ranges(entry.bakedMinMaxStatsDescriptions).filter(({ value }) => !ZERO.test(value)),
    effects: strings(atLevel ? atLevel.bakedDescriptions : entry.bakedDescriptions),
    qualityEffects: strings(entry.qualityBakedDescriptions),
    requirements: ranges(entry.backedMinMaxRequires),
    attributes: Object.fromEntries(
      objs(entry.gemStats).flatMap((stat) => {
        const attribute = str(stat.slug);
        const value = num(stat.value);
        return attribute && ['str', 'dex', 'int'].includes(attribute) && value ? [[attribute, value]] : [];
      }),
    ),
  };
}

function levelStats(level: number, atLevel: Obj): NameValue[] {
  const values = new Map(objs(atLevel.skillLevelStats).map((stat) => [str(stat.slug), num(stat.value)]));
  const stats: NameValue[] = [{ name: 'Level', value: String(level) }];
  const castTime = values.get('castTime');
  if (castTime) stats.push({ name: 'Cast Time', value: `${castTime} s` });
  const manaCost = values.get('manaCost');
  if (manaCost) stats.push({ name: 'Mana Cost', value: String(manaCost) });
  const reservation = values.get('reservation');
  if (reservation) stats.push({ name: 'Reservation', value: String(reservation) });
  return stats;
}

/** Values like "0.0" or "0%" carry no information (e.g. a skill without a regular cast time). */
const ZERO = /^0+(\.0+)?%?$/;

/** Site-formatted `{ value, description: { name } }` pairs. */
function ranges(raw: unknown): NameValue[] {
  return objs(raw).flatMap((stat) => {
    const name = str(obj(stat.description)?.name);
    const value = str(stat.value);
    return name && value ? [{ name, value }] : [];
  });
}

function attributes(raw: Obj | null): Attributes | null {
  if (!raw) return null;
  return { str: num(raw.str) ?? 0, dex: num(raw.dex) ?? 0, int: num(raw.int) ?? 0 };
}

const NUMERALS: Record<string, string> = { two: 'II', three: 'III', four: 'IV' };

/** "supportexecuteplayerthree" → "Execute III". Word breaks inside the slug can't be recovered. */
function nameFromSlug(slug: string): string {
  const match = /^(?:support)?(.+?)player(two|three|four)?$/.exec(slug);
  const base = match?.[1] ?? slug;
  const numeral = match?.[2] ? ` ${NUMERALS[match[2]]}` : '';
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}${numeral}`;
}
