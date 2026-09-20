import { describe, expect, it } from 'vitest';
import type { Build } from '@/lib/build/model';
import { parseBuild } from '@/lib/build/parse-build';
import { loadFixture } from '../../../tests/fixtures/load';
import { buildSheets } from './build-sheets';

const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
const BUILD: Build = parseBuild(fixture.build, fixture.staticData);
const URL = 'https://mobalytics.gg/poe-2/builds/chaos-dot-lich-starter-deadrabbit';

const sheet = (name: string) => buildSheets(BUILD, URL).find((s) => s.name === name)!;
const column = (name: string, index: number) => sheet(name).rows.slice(1).map((row) => row[index]);

describe('buildSheets', () => {
  it('lays the build out as the sheets a reader would expect', () => {
    expect(buildSheets(BUILD, URL).map((s) => s.name)).toEqual(['Overview', 'Gear', 'Skills', 'Gem Priority', 'Passives', 'Quest Rewards']);
  });

  it('opens with what the build is and where it came from', () => {
    const rows = sheet('Overview').rows;

    expect(rows[0]).toEqual(['Field', 'Value']);
    expect(rows).toContainEqual(['Build', BUILD.title]);
    expect(rows).toContainEqual(['Class', 'Witch']);
    expect(rows).toContainEqual(['Ascendancy', 'Lich']);
    expect(rows).toContainEqual(['Patch', '0.5.5']);
    expect(rows).toContainEqual(['Guide', URL]);
  });

  // A column per variant would grow without end; one row per item, tagged with its variant, filters and pivots.
  it('gives every gear row its variant, so the sheet can be filtered by stage', () => {
    const gear = sheet('Gear');

    expect(gear.rows[0]).toEqual(['Variant', 'Slot', 'Item', 'Rarity', 'Implicit', 'Modifiers', 'Sockets', 'Trade']);
    expect(new Set(column('Gear', 0))).toEqual(new Set(BUILD.variants.map((v) => v.title)));

    const helmet = gear.rows.find((row) => row[0] === 'ENDGAME (FULL LIFE)' && row[1] === 'Helmet')!;
    expect(helmet[2]).toBe("Atziri's Disdain");
    expect(helmet[3]).toBe('unique');
    expect(String(helmet[5])).toContain('maximum Mana');
    expect(String(helmet[7])).toContain('pathofexile.com/trade2');
  });

  it('lists the skills with the supports that go in them', () => {
    const skills = sheet('Skills');

    expect(skills.rows[0]).toEqual(['Variant', 'Skill', 'Tags', 'Supports']);
    const drain = skills.rows.find((row) => row[0] === 'ENDGAME (FULL LIFE)' && row[1] === 'Essence Drain')!;
    expect(String(drain[3])).toContain('Chain II');
  });

  it('numbers the gem priority in the order the author put it', () => {
    const priority = sheet('Gem Priority');

    expect(priority.rows[0]).toEqual(['Variant', '#', 'Gem', 'For skill']);
    expect(priority.rows[1]?.[1]).toBe(1);
    expect(typeof priority.rows[1]?.[2]).toBe('string');
  });

  it('keeps the passives with their points, ascendancy apart from the tree', () => {
    const passives = sheet('Passives');

    expect(passives.rows[0]).toEqual(['Variant', 'Kind', '#', 'Passive', 'Effect']);
    expect(new Set(column('Passives', 1))).toEqual(new Set(['Ascendancy', 'Passive tree']));

    const overview = sheet('Overview').rows;
    expect(overview.some((row) => String(row[0]).startsWith('Passive points'))).toBe(true);
  });

  it('carries the campaign quest rewards, act by act', () => {
    const quests = sheet('Quest Rewards');

    expect(quests.rows[0]).toEqual(['Act', 'Quest', 'Area', 'Reward', 'Choice']);
    expect(quests.rows.length).toBeGreaterThan(1);
  });

  it('leaves out a sheet the build has nothing for', () => {
    const bare: Build = { ...BUILD, questRewards: [], variants: [] };

    expect(buildSheets(bare, URL).map((s) => s.name)).toEqual(['Overview']);
  });
});
