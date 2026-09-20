const text = new TextDecoder();

export interface ZipEntry {
  name: string;
  content: string;
}

/** Reads an archive the way a spreadsheet program would: through its central directory. */
export function readZip(archive: Uint8Array): ZipEntry[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const end = archive.length - 22;
  if (view.getUint32(end, true) !== 0x06054b50) throw new Error('not a zip archive');

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error(`broken central directory at ${at}`);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const size = view.getUint32(at + 24, true);
    const offset = view.getUint32(at + 42, true);
    const name = text.decode(archive.subarray(at + 46, at + 46 + nameLength));

    if (view.getUint32(offset, true) !== 0x04034b50) throw new Error(`broken entry ${name}`);
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    entries.push({ name, content: text.decode(archive.subarray(start, start + size)) });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** One named part of an archive, for tests that care about a single file in it. */
export function readZipPart(archive: Uint8Array, name: string): string {
  const entry = readZip(archive).find((part) => part.name === name);
  if (!entry) throw new Error(`no ${name} in the archive`);
  return entry.content;
}
