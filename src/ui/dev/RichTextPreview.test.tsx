import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { parseBuild } from '@/lib/build/parse-build';
import { loadFixture } from '../../../tests/fixtures/load';
import { RichTextPreview } from './RichTextPreview';

describe('RichTextPreview', () => {
  const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
  const build = parseBuild(fixture.build, fixture.staticData);

  it('shows every guide text of the build under its title', () => {
    render(<RichTextPreview build={build} />);

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(expect.arrayContaining(['Build Overview', 'How it Plays', 'Strengths', 'Weaknesses', 'ACT 1 · Description', 'ACT 1 · Equipment']));
    expect(screen.getAllByText('Contagion').length).toBeGreaterThan(0);
  });
});
