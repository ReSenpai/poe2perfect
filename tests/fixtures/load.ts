import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BuildFixture } from '@/lib/dev/fixture';

/**
 * Builds captured from mobalytics.gg with the dev popup ("Экспорт фикстуры"). The guide wording is replaced with
 * placeholder words (see `scrubBuildDocument`), so tests take expected text from the fixture data itself.
 */
export const FIXTURE_SLUGS = [
  'chaos-dot-lich-starter-deadrabbit',
  'deadrabbit-grenades-gemling-league-starter',
  'dreamcore-gas-grenade-pathfinder',
] as const;

export type FixtureSlug = (typeof FIXTURE_SLUGS)[number];

const cache = new Map<FixtureSlug, BuildFixture>();

/** Text of every text node of a guide text, in order. */
export function textNodes(value: { root: unknown } | null | undefined): string[] {
  const texts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const { type, text, children } = node as { type?: unknown; text?: unknown; children?: unknown };
    if (type === 'text' && typeof text === 'string') texts.push(text);
    if (Array.isArray(children)) children.forEach(walk);
  };
  walk(value?.root);
  return texts;
}

export function loadFixture(slug: FixtureSlug): BuildFixture {
  let fixture = cache.get(slug);
  if (!fixture) {
    fixture = JSON.parse(readFileSync(resolve('tests/fixtures', `${slug}.json`), 'utf-8')) as BuildFixture;
    cache.set(slug, fixture);
  }
  return fixture;
}
