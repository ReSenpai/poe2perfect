import { describe, expect, it } from 'vitest';
import { rememberPerBuild } from './preferences';

const entry = (n: number) => ({ id: `id-${n}`, title: `Act ${n}` });

describe('rememberPerBuild', () => {
  it('keeps the variant a build was last read at', () => {
    const remembered = rememberPerBuild({}, 'build-a', entry(1));

    expect(remembered).toEqual({ 'build-a': entry(1) });
  });

  it('replaces what it knew about that build', () => {
    const remembered = rememberPerBuild({ 'build-a': entry(1) }, 'build-a', entry(2));

    expect(remembered).toEqual({ 'build-a': entry(2) });
  });

  it('forgets the builds read longest ago, so the record cannot grow without end', () => {
    let remembered: Record<string, { id: string; title: string }> = {};
    for (let i = 1; i <= 35; i++) remembered = rememberPerBuild(remembered, `build-${i}`, entry(i));

    expect(Object.keys(remembered)).toHaveLength(30);
    expect(remembered['build-1']).toBeUndefined();
    expect(remembered['build-35']).toEqual(entry(35));
  });
});
