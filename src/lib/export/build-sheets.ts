import type { Build, Passive, Variant } from '@/lib/build/model';
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
  return rows;
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
