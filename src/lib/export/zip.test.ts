import { describe, expect, it } from 'vitest';
import { zip } from './zip';

const text = new TextDecoder();

/** Reads an archive back the way a spreadsheet program would: through its central directory. */
function entries(archive: Uint8Array): { name: string; content: string }[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const end = archive.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);

  const read: { name: string; content: string }[] = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const size = view.getUint32(at + 24, true);
    const offset = view.getUint32(at + 42, true);
    const name = text.decode(archive.subarray(at + 46, at + 46 + nameLength));

    expect(view.getUint32(offset, true)).toBe(0x04034b50);
    const localName = view.getUint16(offset + 26, true);
    const localExtra = view.getUint16(offset + 28, true);
    const start = offset + 30 + localName + localExtra;
    read.push({ name, content: text.decode(archive.subarray(start, start + size)) });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return read;
}

describe('zip', () => {
  it('packs files under their names, readable through the central directory', () => {
    const archive = zip([
      { name: 'hello.txt', data: 'Hello, exile' },
      { name: 'xl/worksheets/sheet1.xml', data: '<worksheet/>' },
    ]);

    expect(entries(archive)).toEqual([
      { name: 'hello.txt', content: 'Hello, exile' },
      { name: 'xl/worksheets/sheet1.xml', content: '<worksheet/>' },
    ]);
  });

  it('starts with the signature that marks a zip archive', () => {
    expect([...zip([{ name: 'a', data: 'b' }]).subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('keeps text as UTF-8, so names and values in other alphabets survive', () => {
    const archive = zip([{ name: 'имя.txt', data: 'Эссенция' }]);

    expect(entries(archive)).toEqual([{ name: 'имя.txt', content: 'Эссенция' }]);
  });

  it('checksums each file, so a reader can tell the archive is whole', () => {
    const archive = zip([{ name: 'a.txt', data: 'The quick brown fox jumps over the lazy dog' }]);
    const view = new DataView(archive.buffer);

    // CRC-32 of that sentence, a value every zip tool agrees on.
    expect(view.getUint32(14, true)).toBe(0x414fa339);
  });

  it('makes an empty archive when there is nothing to pack', () => {
    expect(entries(zip([]))).toEqual([]);
  });
});
