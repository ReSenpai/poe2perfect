export interface ZipFile {
  name: string;
  data: string | Uint8Array;
}

const encoder = new TextEncoder();

/**
 * Packs files into a zip archive, stored as they are (no compression). That is all a spreadsheet file needs: an
 * .xlsx is a zip of XML parts, and Excel, LibreOffice and Google Sheets all read stored entries.
 */
export function zip(files: ZipFile[]): Uint8Array {
  const entries = files.map(({ name, data }) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    return { name: encoder.encode(name), bytes, crc: crc32(bytes) };
  });

  const localSize = entries.reduce((sum, e) => sum + 30 + e.name.length + e.bytes.length, 0);
  const centralSize = entries.reduce((sum, e) => sum + 46 + e.name.length, 0);
  const archive = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(archive.buffer);

  let at = 0;
  const offsets: number[] = [];
  for (const entry of entries) {
    offsets.push(at);
    view.setUint32(at, 0x04034b50, true); // local file header
    view.setUint16(at + 4, 20, true); // version needed
    view.setUint16(at + 6, 0x0800, true); // names and text are UTF-8
    view.setUint16(at + 8, 0, true); // stored, not compressed
    view.setUint32(at + 14, entry.crc, true);
    view.setUint32(at + 18, entry.bytes.length, true);
    view.setUint32(at + 22, entry.bytes.length, true);
    view.setUint16(at + 26, entry.name.length, true);
    archive.set(entry.name, at + 30);
    archive.set(entry.bytes, at + 30 + entry.name.length);
    at += 30 + entry.name.length + entry.bytes.length;
  }

  const centralStart = at;
  entries.forEach((entry, i) => {
    view.setUint32(at, 0x02014b50, true); // central directory header
    view.setUint16(at + 4, 20, true); // version made by
    view.setUint16(at + 6, 20, true); // version needed
    view.setUint16(at + 8, 0x0800, true);
    view.setUint16(at + 10, 0, true);
    view.setUint32(at + 16, entry.crc, true);
    view.setUint32(at + 20, entry.bytes.length, true);
    view.setUint32(at + 24, entry.bytes.length, true);
    view.setUint16(at + 28, entry.name.length, true);
    view.setUint32(at + 42, offsets[i]!, true);
    archive.set(entry.name, at + 46);
    at += 46 + entry.name.length;
  });

  view.setUint32(at, 0x06054b50, true); // end of central directory
  view.setUint16(at + 8, entries.length, true);
  view.setUint16(at + 10, entries.length, true);
  view.setUint32(at + 12, at - centralStart, true);
  view.setUint32(at + 16, centralStart, true);
  return archive;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
