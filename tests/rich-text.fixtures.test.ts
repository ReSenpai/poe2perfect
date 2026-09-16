import { describe, expect, it } from 'vitest';
import { parseBuild } from '@/lib/build/parse-build';
import type { RichText } from '@/lib/build/model';
import { type RichBlock, type RichInline, toRichBlocks } from '@/lib/rich-text/convert';
import { FIXTURE_SLUGS, loadFixture } from './fixtures/load';

function allRichTexts(slug: (typeof FIXTURE_SLUGS)[number]): RichText[] {
  const fixture = loadFixture(slug);
  const build = parseBuild(fixture.build, fixture.staticData);
  return [
    ...build.sections.map((s) => s.content),
    build.strengths,
    build.weaknesses,
    ...build.variants.flatMap((v) => [v.description, v.equipmentNotes, v.skillNotes, v.passiveNotes]),
  ].filter((value): value is RichText => value !== null);
}

/** Counts of text-bearing raw Lexical nodes. */
function rawCounts(value: unknown) {
  const counts = { entities: 0, links: 0, words: 0 };
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node !== 'object' || node === null) return;
    const n = node as Record<string, unknown>;
    if (n.type === 'static-data-widget') counts.entities++;
    if (n.type === 'link') counts.links++;
    if (n.type === 'text' && typeof n.text === 'string') counts.words += n.text.split(/\s+/).filter(Boolean).length;
    visit(n.children);
  };
  visit((value as { root: unknown }).root);
  return counts;
}

function convertedCounts(blocks: RichBlock[]) {
  const counts = { entities: 0, links: 0, words: 0 };
  const visitInline = (node: RichInline) => {
    if (node.kind === 'entity') counts.entities++;
    if (node.kind === 'text') counts.words += node.text.split(/\s+/).filter(Boolean).length;
    if (node.kind === 'link') {
      counts.links++;
      node.children.forEach(visitInline);
    }
  };
  const visitBlock = (block: RichBlock) => {
    if (block.kind === 'list') {
      block.items.forEach((item) => {
        item.children.forEach(visitInline);
        item.lists.forEach(visitBlock);
      });
    } else {
      block.children.forEach(visitInline);
    }
  };
  blocks.forEach(visitBlock);
  return counts;
}

describe.each(FIXTURE_SLUGS)('rich texts of %s', (slug) => {
  it('lose no words, entities or links in conversion', () => {
    const texts = allRichTexts(slug);
    expect(texts.length).toBeGreaterThan(3);

    for (const text of texts) {
      expect(convertedCounts(toRichBlocks(text))).toEqual(rawCounts(text));
    }
  });
});
