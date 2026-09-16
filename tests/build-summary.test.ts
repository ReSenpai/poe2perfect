import { describe, expect, it } from 'vitest';
import { parseBuild } from '@/lib/build/parse-build';
import { summarizeBuild } from '@/lib/dev/build-summary';
import { loadFixture } from './fixtures/load';

describe('summarizeBuild', () => {
  it('condenses a parsed build into a short, checkable report', () => {
    const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
    const summary = summarizeBuild(parseBuild(fixture.build, fixture.staticData));

    expect(summary).toMatchObject({
      title: 'ED Contagion Lich League Starter (Level 1 to Endgame)',
      patch: '0.5.5',
      hero: 'Witch / Lich',
      hasStaticData: true,
      sections: ['Build Overview', 'How it Plays'],
      defaultVariant: 'ACT 1',
    });
    expect(summary.variants).toHaveLength(6);
    expect(summary.variants[4]).toMatchObject({
      title: 'ENDGAME (FULL LIFE)',
      helmet: "Atziri's Disdain",
      firstSkill: expect.stringMatching(/^Essence Drain \(\d supports\)$/),
    });
    expect(summary.variants[4]?.items).toBeGreaterThan(5);
    expect(summary.variants[4]?.ascendancy).toContain('Eternal Life');
  });
});
