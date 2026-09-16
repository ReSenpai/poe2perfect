import { describe, expect, it } from 'vitest';
import type { Build, Variant } from '@/lib/build/model';
import { availableTabs, formatRoute, parseRoute, TABS, variantSlugs } from './route';

function buildWith(titles: string[], defaultIndex = 0, { atlas = false } = {}): Build {
  const variants = titles.map((title, i) => ({ id: `id-${i}`, title, atlas: atlas && i === titles.length - 1 ? { pointCount: 1, groups: [] } : null }) as Variant);
  return { variants, defaultVariantId: variants[defaultIndex]?.id ?? null } as Build;
}

const BUILD = buildWith(['ACT 1', 'ACT 4 - Endgame', 'ENDGAME (FULL LIFE)', 'Gas Grenade Swap ~L50-55']);

describe('TABS', () => {
  it('lists the tabs in display order', () => {
    expect(TABS.map((tab) => tab.id)).toEqual(['overview', 'skills', 'gear', 'passives', 'atlas', 'progression']);
    expect(TABS.map((tab) => tab.label)).toEqual(['Overview', 'Skills', 'Gear', 'Passives', 'Atlas Tree', 'Progression']);
  });
});

describe('availableTabs', () => {
  it('shows the atlas tree only for builds with an atlas tree in some variant', () => {
    expect(availableTabs(buildWith(['ACT 1', 'Endgame'], 0, { atlas: true })).map((tab) => tab.id)).toContain('atlas');
    expect(availableTabs(BUILD).map((tab) => tab.id)).toEqual(['overview', 'skills', 'gear', 'passives', 'progression']);
  });

  it('opens the overview for an atlas hash on a build without an atlas tree', () => {
    expect(parseRoute('#atlas_act-1', BUILD).tab).toBe('overview');
    expect(parseRoute('#atlas_endgame', buildWith(['ACT 1', 'Endgame'], 0, { atlas: true }))).toEqual({ tab: 'atlas', variantId: 'id-1' });
  });
});

describe('variantSlugs', () => {
  it('turns variant titles into readable, unique slugs', () => {
    const slugs = variantSlugs(buildWith(['ACT 1', 'ENDGAME (FULL LIFE)', 'Act 1', '3rd Ascension ~L65', '!!!']));

    expect([...slugs.bySlug.keys()]).toEqual(['act-1', 'endgame-full-life', 'act-1-2', '3rd-ascension-l65', 'variant-5']);
    expect(slugs.byId.get('id-1')).toBe('endgame-full-life');
    expect(slugs.bySlug.get('act-1-2')).toBe('id-2');
  });
});

describe('parseRoute', () => {
  it('reads tab and variant from the hash', () => {
    expect(parseRoute('#gear_endgame-full-life', BUILD)).toEqual({ tab: 'gear', variantId: 'id-2' });
  });

  it('falls back to the default variant for a tab without one', () => {
    expect(parseRoute('#skills', buildWith(['A', 'B'], 1))).toEqual({ tab: 'skills', variantId: 'id-1' });
  });

  it('ignores an unknown variant', () => {
    expect(parseRoute('#passives_nope', BUILD)).toEqual({ tab: 'passives', variantId: 'id-0' });
  });

  it.each([
    ['empty hash', ''],
    ['site anchor', '#4b46748c-2c9b-4cb5-b49e-7d4dddb609b6-equipment-4'],
    ['unknown tab', '#talents_act-1'],
    ['removed notes tab', '#notes'],
  ])('opens the overview for %s', (_name, hash) => {
    expect(parseRoute(hash, BUILD)).toEqual({ tab: 'overview', variantId: 'id-0' });
  });

  it('opens a fallback tab (e.g. the one used last) when the hash names no tab', () => {
    expect(parseRoute('', BUILD, 'passives')).toEqual({ tab: 'passives', variantId: 'id-0' });
    expect(parseRoute('#4b46748c-equipment-4', BUILD, 'skills').tab).toBe('skills');
    expect(parseRoute('#gear', BUILD, 'passives').tab).toBe('gear');
  });

  it('ignores a fallback tab the build does not have', () => {
    expect(parseRoute('', BUILD, 'atlas').tab).toBe('overview');
  });

  it('decodes percent-encoded hashes', () => {
    expect(parseRoute('#gear%5Fact-4-endgame', BUILD)).toEqual({ tab: 'gear', variantId: 'id-1' });
  });

  it('works for a build without variants', () => {
    expect(parseRoute('#gear_act-1', buildWith([]))).toEqual({ tab: 'gear', variantId: null });
  });
});

describe('formatRoute', () => {
  it('writes the variant for tabs that depend on it', () => {
    expect(formatRoute({ tab: 'gear', variantId: 'id-3' }, BUILD)).toBe('#gear_gas-grenade-swap-l50-55');
    expect(formatRoute({ tab: 'progression', variantId: 'id-0' }, BUILD)).toBe('#progression_act-1');
  });

  it('omits the variant for tabs that show the whole build', () => {
    expect(formatRoute({ tab: 'overview', variantId: 'id-3' }, BUILD)).toBe('#overview');
  });

  it('only produces hashes that are safe inside a CSS selector', () => {
    // The site runs querySelector('#toc-item-' + hash + '-id') on load and crashes on characters like "/".
    for (const tab of TABS) {
      for (const variant of BUILD.variants) {
        expect(formatRoute({ tab: tab.id, variantId: variant.id }, BUILD)).toMatch(/^#[a-z0-9_-]+$/);
      }
    }
  });

  it('round-trips through parseRoute', () => {
    const route = { tab: 'passives' as const, variantId: 'id-2' };

    expect(parseRoute(formatRoute(route, BUILD), BUILD)).toEqual(route);
  });
});
