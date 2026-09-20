import { describe, expect, it } from 'vitest';
import { readZip, readZipPart } from '../../../tests/helpers/read-zip';
import { workbook } from './xlsx';

const SHEETS = [
  { name: 'Gear', rows: [['Slot', 'Item', 'Level'], ['Helmet', "Atziri's Disdain", 40]] },
  { name: 'Skills', rows: [['Skill'], ['Essence Drain']] },
];

describe('workbook', () => {
  it('writes the parts a spreadsheet program looks for', () => {
    const names = readZip(workbook(SHEETS)).map((entry) => entry.name);

    expect(names).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]);
  });

  it('names each sheet as its tab', () => {
    const xml = readZipPart(workbook(SHEETS), 'xl/workbook.xml');

    expect(xml).toContain('<sheet name="Gear" sheetId="1" r:id="rId1"/>');
    expect(xml).toContain('<sheet name="Skills" sheetId="2" r:id="rId2"/>');
  });

  it('writes text and numbers as the kinds of cell they are, so sums and filters work', () => {
    const xml = readZipPart(workbook(SHEETS), 'xl/worksheets/sheet1.xml');

    expect(xml).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">Helmet</t></is></c>');
    expect(xml).toContain('<c r="C2"><v>40</v></c>');
  });

  it('escapes what would otherwise break the file', () => {
    const xml = readZipPart(workbook([{ name: 'Gear', rows: [['Life & ES < 5 > "high"']] }]), 'xl/worksheets/sheet1.xml');

    expect(xml).toContain('Life &amp; ES &lt; 5 &gt; &quot;high&quot;');
  });

  it('leaves a cell empty where the build says nothing', () => {
    const xml = readZipPart(workbook([{ name: 'Gear', rows: [['Slot', null, 'Level']] }]), 'xl/worksheets/sheet1.xml');

    expect(xml).toContain('<c r="A1"');
    expect(xml).not.toContain('<c r="B1"');
    expect(xml).toContain('<c r="C1"');
  });

  it('keeps the heading in view and ready to filter', () => {
    const xml = readZipPart(workbook(SHEETS), 'xl/worksheets/sheet1.xml');

    expect(xml).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(xml).toContain('<autoFilter ref="A1:C1"/>');
  });

  // Excel refuses a workbook whose tab names break its rules, and simply shows nothing.
  it('makes every tab name one a spreadsheet accepts', () => {
    const xml = readZipPart(workbook([{ name: 'Gear: Act 1/2 [main] — a very, very long stage name', rows: [['a']] }]), 'xl/workbook.xml');

    const name = /<sheet name="([^"]*)"/.exec(xml)![1]!;
    expect(name.length).toBeLessThanOrEqual(31);
    expect(name).not.toMatch(/[:\/?*[\]]/);
    expect(name.startsWith('Gear Act 12 main')).toBe(true);
  });

  // Without this Excel runs the lines together and the modifiers of an item read as one long line.
  it('lets a cell of several lines show them', () => {
    const modifiers = ['+60 to maximum Life', '+11% to Fire Resistance'].join('\n');
    const xml = readZipPart(workbook([{ name: 'Gear', rows: [['Modifiers'], [modifiers]] }]), 'xl/worksheets/sheet1.xml');

    expect(xml).toContain('<c r="A2" s="2" t="inlineStr">');
  });

  it('gives each column a width to suit what is in it', () => {
    const xml = readZipPart(workbook(SHEETS), 'xl/worksheets/sheet1.xml');

    expect(xml).toMatch(/<cols><col min="1" max="1" width="[\d.]+" customWidth="1"\/>/);
  });
});
