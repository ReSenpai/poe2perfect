import { describe, expect, it } from 'vitest';
import { getBuildSlug } from '@/lib/build-url';
import { extractBuildDocument } from '@/lib/data/preloaded-state';
import { pickStaticSubset } from '@/lib/data/static-subset';
import type { RawStaticData } from '@/lib/data/types';
import { FIXTURE_SLUGS, loadFixture } from './fixtures/load';

interface Variant {
  skillGems?: { gems?: { activeSkill?: { gemSlug?: string } | null; subSkills?: { gemSlug?: string }[] | null }[] };
  equipment?: Record<string, { commonItem?: { slug?: string; isUnique?: boolean } | null } | null>;
  passiveTree?: { mainTree?: { selectedSlugs?: string[] } | null };
}

function variants(slug: (typeof FIXTURE_SLUGS)[number]) {
  return (loadFixture(slug).build.data.buildVariants?.values ?? []) as Variant[];
}

function slugsOf(staticData: RawStaticData, ...categories: string[]) {
  const slugs = new Set<string>();
  for (const name of categories) {
    const category = staticData[name];
    for (const entry of (category?.data ?? []) as { slug?: string }[]) if (entry.slug) slugs.add(entry.slug);
  }
  return slugs;
}

function graphNodes(staticData: RawStaticData) {
  const trees = (staticData.poe2PassiveSkillsGraph?.data ?? []) as { groups: { nodes: { slug: string; passiveSlug: string }[] }[] }[];
  return trees.flatMap((tree) => tree.groups.flatMap((group) => group.nodes));
}

/** Page HTML the way mobalytics renders it: the state script with "/" escaped. */
function pageHtml(build: unknown) {
  const state = {
    poe2State: {
      apollo: {
        graphqlV2: {
          queries: [
            {
              queryKey: ['ngf-ug-featured-document-page'],
              state: { data: [{ game: { documents: { userGeneratedDocumentBySlug: { error: null, data: build } } } }, null] },
            },
          ],
        },
      },
    },
  };
  const json = JSON.stringify(state).replaceAll('/', '\\u002F').replaceAll('<', '\\u003C');
  return `<!doctype html><html><head><script>window.__PRELOADED_STATE__=${json};</script></head><body></body></html>`;
}

describe.each(FIXTURE_SLUGS)('fixture %s', (slug) => {
  const fixture = loadFixture(slug);
  const staticData = fixture.staticData!;

  it('was captured from its own build page, with static data', () => {
    expect(getBuildSlug(fixture.meta.url)).toBe(slug);
    expect(staticData).not.toBeNull();
  });

  it('round-trips through page HTML extraction', () => {
    expect(extractBuildDocument(pageHtml(fixture.build))).toEqual({ ok: true, doc: fixture.build });
  });

  it('has every skill and support gem in static data', () => {
    const known = slugsOf(staticData, 'poe2Gems');
    const used = variants(slug).flatMap((variant) =>
      (variant.skillGems?.gems ?? []).flatMap((gem) => [
        gem.activeSkill?.gemSlug,
        ...(gem.subSkills ?? []).map((support) => support.gemSlug),
      ]),
    );

    expect(used.length).toBeGreaterThan(0);
    expect([...new Set(used.filter((s): s is string => !!s && !known.has(s)))]).toEqual([]);
  });

  it('has every unique item in static data', () => {
    const known = slugsOf(staticData, 'poe2Weapons', 'poe2Armours', 'poe2Shields', 'poe2Focuses', 'poe2Quivers', 'poe2Amulets', 'poe2Rings', 'poe2Flasks', 'poe2Jewels');
    const uniques = variants(slug).flatMap((variant) =>
      Object.values(variant.equipment ?? {}).flatMap((slot) => (slot?.commonItem?.isUnique && slot.commonItem.slug ? [slot.commonItem.slug] : [])),
    );

    expect(uniques.filter((s) => !known.has(s))).toEqual([]);
  });

  it('has every selected passive node and its passive skill', () => {
    const nodes = new Map(graphNodes(staticData).map((node) => [node.slug, node.passiveSlug]));
    const passives = slugsOf(staticData, 'poe2PassiveSkills');
    const selected = variants(slug).flatMap((variant) => variant.passiveTree?.mainTree?.selectedSlugs ?? []);

    expect(selected.length).toBeGreaterThan(0);
    expect(selected.filter((node) => !nodes.has(node))).toEqual([]);
    expect(selected.filter((node) => !passives.has(nodes.get(node)!))).toEqual([]);
  });

  it('is already a minimal subset', () => {
    expect(pickStaticSubset(staticData, fixture.build)).toEqual(staticData);
  });
});
