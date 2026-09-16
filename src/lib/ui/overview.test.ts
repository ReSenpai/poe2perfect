import { describe, expect, it } from 'vitest';
import type { Build, EquipmentSlot, Item, Variant } from '@/lib/build/model';
import { formatUpdated, keyUniques, showcaseVariant, videoHost } from './overview';

function item(slug: string, rarity: Item['rarity']): Item {
  return { slug, name: slug, rarity } as Item;
}

function slot(id: EquipmentSlot['slot'], equipped: Item, weaponSet: 1 | 2 | null = null): EquipmentSlot {
  return { slot: id, weaponSet, item: equipped, socketables: [] };
}

function variant(id: string, items: number, skills: number): Variant {
  return {
    id,
    title: id,
    equipment: Array.from({ length: items }, (_, i) => slot('helmet', item(`i${i}`, 'rare'))),
    skills: Array.from({ length: skills }, () => ({ gem: { name: 'g' }, supports: [] })),
  } as unknown as Variant;
}

describe('showcaseVariant', () => {
  it('picks the most complete variant, preferring the later one on a tie', () => {
    const build = { variants: [variant('act-1', 3, 4), variant('endgame', 16, 8), variant('uber', 16, 8), variant('act-2', 10, 9)] } as Build;

    expect(showcaseVariant(build)?.id).toBe('uber');
  });

  it('is null without variants', () => {
    expect(showcaseVariant({ variants: [] } as unknown as Build)).toBeNull();
  });
});

describe('keyUniques', () => {
  it('lists unique items once each, in sheet order', () => {
    const atziri = item('atziri', 'unique');
    const ingenuity = item('ingenuity', 'unique');
    const hope = item('nascent-hope', 'unique');
    const v = {
      equipment: [slot('helmet', atziri), slot('body', item('robe', 'rare')), slot('belt', ingenuity), slot('charm1', hope), slot('charm2', hope)],
    } as Variant;

    expect(keyUniques(v).map((s) => s.item.slug)).toEqual(['atziri', 'ingenuity', 'nascent-hope']);
  });
});

describe('formatUpdated', () => {
  it('formats the update date in English', () => {
    expect(formatUpdated('2026-09-13T10:32:29Z')).toBe('Sep 13, 2026');
  });

  it('is null for a missing or broken date', () => {
    expect(formatUpdated(null)).toBeNull();
    expect(formatUpdated('not a date')).toBeNull();
  });
});

describe('videoHost', () => {
  it.each([
    ['https://youtu.be/APHc82wJtk4', 'YouTube'],
    ['https://www.youtube.com/watch?v=x', 'YouTube'],
    ['https://www.twitch.tv/deadrabb1t', 'Twitch'],
    ['https://vimeo.com/1', 'vimeo.com'],
  ])('names the host of %s', (url, host) => {
    expect(videoHost(url)).toBe(host);
  });

  it('is null for something that is not an http(s) URL', () => {
    expect(videoHost('javascript:alert(1)')).toBeNull();
    expect(videoHost('nope')).toBeNull();
  });
});
