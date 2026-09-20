import { zip } from './zip';

/** A cell the spreadsheet works out itself, e.g. `{ formula: 'SUM(A2:A9)' }` (written without the leading =). */
export interface Formula {
  formula: string;
}

export type CellValue = string | number | Formula | null | undefined;

export interface Sheet {
  /** Shown on the tab; trimmed to what a spreadsheet accepts. */
  name: string;
  /** The first row is the heading: it stays in view and carries the filter. */
  rows: CellValue[][];
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const DOC_RELS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Builds an .xlsx workbook: a zip of XML parts, which Excel, LibreOffice and Google Sheets all read. */
export function workbook(sheets: Sheet[]): Uint8Array {
  const named = sheets.map((sheet, i) => ({ ...sheet, name: tabName(sheet.name, i) }));

  return zip([
    { name: '[Content_Types].xml', data: contentTypes(named.length) },
    { name: '_rels/.rels', data: rootRels() },
    { name: 'xl/workbook.xml', data: workbookXml(named) },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels(named.length) },
    { name: 'xl/styles.xml', data: styles() },
    ...named.map((sheet, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(sheet) })),
  ]);
}

/** Excel refuses names longer than 31 characters or holding : \ / ? * [ ], and shows nothing at all. */
function tabName(name: string, index: number): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, '').trim();
  return cleaned ? cleaned.slice(0, 31) : `Sheet ${index + 1}`;
}

function contentTypes(sheetCount: number): string {
  const sheetParts = Array.from(
    { length: sheetCount },
    (_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');
  return `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetParts}</Types>`;
}

function rootRels(): string {
  return `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${DOC_RELS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

function workbookXml(sheets: Sheet[]): string {
  const tabs = sheets.map((sheet, i) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('');
  return `${XML}<workbook xmlns="${MAIN}" xmlns:r="${DOC_RELS}"><sheets>${tabs}</sheets></workbook>`;
}

function workbookRels(sheetCount: number): string {
  const links = Array.from({ length: sheetCount }, (_, i) => `<Relationship Id="rId${i + 1}" Type="${DOC_RELS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`);
  links.push(`<Relationship Id="rId${sheetCount + 1}" Type="${DOC_RELS}/styles" Target="styles.xml"/>`);
  return `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${links.join('')}</Relationships>`;
}

/** Three formats: plain, the bold one for the heading, and one that shows a cell of several lines. */
function styles(): string {
  return `${XML}<styleSheet xmlns="${MAIN}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function sheetXml(sheet: Sheet): string {
  const width = Math.max(1, ...sheet.rows.map((row) => row.length));
  const rows = sheet.rows.map((row, i) => rowXml(row, i + 1)).join('');
  const filter = sheet.rows.length > 0 ? `<autoFilter ref="A1:${columnName(width)}1"/>` : '';
  const frozen = '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
  return `${XML}<worksheet xmlns="${MAIN}">${frozen}${columnsXml(sheet, width)}<sheetData>${rows}</sheetData>${filter}</worksheet>`;
}

/** Columns as wide as what stands in them, within reason, so nothing has to be resized by hand. */
function columnsXml(sheet: Sheet, width: number): string {
  const cols = Array.from({ length: width }, (_, column) => {
    const longest = sheet.rows.reduce((most, row) => {
      const value = row[column];
      return Math.max(most, typeof value === 'object' && value !== null ? 12 : String(value ?? '').length);
    }, 0);
    const size = Math.min(60, Math.max(10, longest + 2));
    return `<col min="${column + 1}" max="${column + 1}" width="${size}" customWidth="1"/>`;
  }).join('');
  return `<cols>${cols}</cols>`;
}

function rowXml(row: CellValue[], rowNumber: number): string {
  const cells = row
    .map((value, column) => cellXml(value, `${columnName(column + 1)}${rowNumber}`, rowNumber === 1))
    .filter(Boolean)
    .join('');
  return `<row r="${rowNumber}">${cells}</row>`;
}

function cellXml(value: CellValue, reference: string, heading: boolean): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'object') return `<c r="${reference}"${heading ? ' s="1"' : ''}><f>${escapeXml(value.formula)}</f></c>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${reference}"${heading ? ' s="1"' : ''}><v>${value}</v></c>`;

  const text = String(value);
  // A cell of several lines needs the wrapping format, or a spreadsheet runs its lines together.
  const style = heading ? ' s="1"' : /\n/.test(text) ? ' s="2"' : '';
  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function columnName(column: number): string {
  let name = '';
  for (let rest = column; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    name = String.fromCharCode(65 + ((rest - 1) % 26)) + name;
  }
  return name;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
}
