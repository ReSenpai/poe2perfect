import type { Build, Passive, Variant } from '@/lib/build/model';
import { parseModifier, type StatKind } from '@/lib/stats/parse-modifier';
import { slotLabel } from '@/lib/ui/slots';
import type { CellValue, Sheet } from './xlsx';

/**
 * The build as a set of tables. Every row carries the variant it belongs to, so one sheet holds the whole build
 * and a reader can filter it by stage or pivot on it — which is what a spreadsheet is for.
 */
export function buildSheets(build: Build, url: string): Sheet[] {
  const sheets: Sheet[] = [{ name: 'Overview', rows: overviewRows(build, url) }];
  const withRows = (name: string, header: CellValue[], rows: CellValue[][]) => {
    if (rows.length > 0) sheets.push({ name, rows: [header, ...rows] });
  };

  const stats = build.variants.flatMap(statRows);
  withRows('Totals', ['Variant', 'Stat', 'Flat', 'Increased %', 'More %', 'Estimate'], totalRows(stats));
  withRows('Stats', ['Variant', 'Source', 'From', 'Stat', 'Kind', '%', 'Value', 'Min', 'Max', 'Line'], stats.map(statRow));

  withRows('Gear', ['Variant', 'Slot', 'Item', 'Rarity', 'Implicit', 'Modifiers', 'Sockets', 'Trade'], build.variants.flatMap(gearRows));
  withRows('Skills', ['Variant', 'Skill', 'Tags', 'Supports'], build.variants.flatMap(skillRows));
  withRows('Gem Priority', ['Variant', '#', 'Gem', 'For skill'], build.variants.flatMap(gemPriorityRows));
  withRows('Passives', ['Variant', 'Kind', '#', 'Passive', 'Effect'], build.variants.flatMap(passiveRows));
  withRows('Quest Rewards', ['Act', 'Quest', 'Area', 'Reward', 'Choice'], questRows(build));

  return sheets;
}

function overviewRows(build: Build, url: string): CellValue[][] {
  const rows: CellValue[][] = [['Field', 'Value'], ['Build', build.title]];
  const add = (field: string, value: CellValue) => {
    if (value !== null && value !== undefined && value !== '') rows.push([field, value]);
  };

  add('Class', build.className);
  add('Ascendancy', build.ascendancy);
  add('Patch', build.patch);
  add('Author', build.author);
  add('Updated', build.updatedAt);
  add('Tags', build.buildTypes.join(', '));
  add('Guide', url);
  add('Variants', build.variants.map((variant) => variant.title).join(', '));

  for (const variant of build.variants) {
    const { nodeCount, ascendancyNodeCount } = variant.passives;
    add(`Passive points · ${variant.title}`, nodeCount);
    if (ascendancyNodeCount > 0) add(`Ascendancy points · ${variant.title}`, ascendancyNodeCount);
    if (variant.atlas) add(`Atlas points · ${variant.title}`, variant.atlas.pointCount);
  }

  rows.push(['Note', 'Totals add up what the gear and passives of this build give. Your character’s own life, mana and the resistance penalty of the acts are not in them.']);
  rows.push(['Note', 'Estimate = Flat × (1 + Increased% ) × (1 + More% ). Change a number on the Stats sheet and the totals follow.']);
  rows.push(['Note', 'A roll written as a range, e.g. +(7-13)%, is counted at its middle; its ends are in the Min and Max columns.']);
  return rows;
}

interface StatEntry {
  variant: string;
  source: string;
  from: string;
  stat: string;
  kind: StatKind;
  percent: boolean;
  value: number;
  min: number;
  max: number;
  line: string;
}

/** Every modifier of the variant as a number with its source: the table the totals are summed from. */
function statRows(variant: Variant): StatEntry[] {
  const entries: StatEntry[] = [];
  const read = (source: string, from: string, lines: string[]) => {
    for (const line of lines) {
      for (const value of parseModifier(line)) {
        entries.push({ variant: variant.title, source, from, line, ...value });
      }
    }
  };

  for (const { slot, weaponSet, item, socketables } of variant.equipment) {
    const where = slotLabel(slot, weaponSet) ?? slot;
    read(where, item.name, [...item.implicits, ...item.modifiers]);
    for (const socketable of socketables) read(where, socketable.name ?? socketable.slug, socketable.effects);
  }
  read('Ascendancy', 'Ascendancy', variant.passives.ascendancy.flatMap((passive) => passive.effects));
  for (const passive of variant.passives.keyPassives) read('Passive tree', passive.name, passive.effects);

  return entries;
}

function statRow(entry: StatEntry): CellValue[] {
  return [entry.variant, entry.source, entry.from, entry.stat, entry.kind, entry.percent ? '%' : null, entry.value, entry.min, entry.max, entry.line];
}

/**
 * One row per stat of each variant, summed from the Stats sheet by formula rather than worked out here: the
 * reader can change a roll, drop a row or add their own, and the totals follow.
 */
function totalRows(stats: StatEntry[]): CellValue[][] {
  const seen = new Map<string, { variant: string; stat: string; weight: number }>();
  for (const entry of stats) {
    const key = `${entry.variant}\u0000${entry.stat}`;
    const known = seen.get(key) ?? { variant: entry.variant, stat: entry.stat, weight: 0 };
    known.weight += Math.abs(entry.value);
    seen.set(key, known);
  }

  return [...seen.values()]
    .sort((a, b) => (a.variant === b.variant ? b.weight - a.weight : 0))
    .map((row, i) => {
      const at = i + 2; // the heading takes the first row
      const sum = (kind: StatKind) => ({
        formula: `SUMIFS(Stats!$G:$G,Stats!$A:$A,$A${at},Stats!$D:$D,$B${at},Stats!$E:$E,"${kind}")`,
      });
      return [row.variant, row.stat, sum('flat'), sum('increased'), sum('more'), { formula: `C${at}*(1+D${at}/100)*(1+E${at}/100)` }];
    });
}

function gearRows(variant: Variant): CellValue[][] {
  return variant.equipment.map(({ slot, weaponSet, item, socketables }) => [
    variant.title,
    slotLabel(slot, weaponSet),
    item.name,
    item.rarity,
    item.implicits.join(' · '),
    [...item.grantedSkills.map((skill) => `Grants: ${skill.name}`), ...item.modifiers].join('\n'),
    socketables.map((socketable) => socketable.name ?? socketable.slug).join(', '),
    item.tradeUrl,
  ]);
}

function skillRows(variant: Variant): CellValue[][] {
  return variant.skills.map(({ gem, supports }) => [
    variant.title,
    gem.name,
    gem.details?.tags.join(' · ') ?? null,
    supports.map((support) => support.name).join(', '),
  ]);
}

function gemPriorityRows(variant: Variant): CellValue[][] {
  return variant.gemPriority.map((entry, i) => [variant.title, i + 1, entry.gem.name, entry.parentName]);
}

function passiveRows(variant: Variant): CellValue[][] {
  const rows = (kind: string, passives: Passive[]): CellValue[][] =>
    passives.map((passive, i) => [variant.title, kind, i + 1, passive.name, passive.effects.join('\n')]);

  return [...rows('Ascendancy', variant.passives.ascendancy), ...rows('Passive tree', variant.passives.keyPassives)];
}

function questRows(build: Build): CellValue[][] {
  return build.questRewards.flatMap((act) =>
    act.quests.map((quest) => [act.act, quest.name, quest.area, quest.reward, quest.isChoice ? 'yes' : null]),
  );
}
