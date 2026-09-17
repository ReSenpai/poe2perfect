import { describe, expect, it } from 'vitest';
import { rememberVariant } from './preferences';

const entry = (n: number) => ({ id: `id-${n}`, title: `Act ${n}` });

describe('rememberVariant', () => {
  it('keeps the variant a build was last read at', () => {
    const remembered = rememberVariant({}, 'build-a', entry(1));

    expect(remembered).toEqual({ 'build-a': entry(1) });
  });

  it('replaces what it knew about that build', () => {
    const remembered = rememberVariant({ 'build-a': entry(1) }, 'build-a', entry(2));

    expect(remembered).toEqual({ 'build-a': entry(2) });
  });

  it('forgets the builds read longest ago, so the record cannot grow without end', () => {
    let remembered: Record<string, { id: string; title: string }> = {};
    for (let i = 1; i <= 35; i++) remembered = rememberVariant(remembered, `build-${i}`, entry(i));

    expect(Object.keys(remembered)).toHaveLength(30);
    expect(remembered['build-1']).toBeUndefined();
    expect(remembered['build-35']).toEqual(entry(35));
  });
});
