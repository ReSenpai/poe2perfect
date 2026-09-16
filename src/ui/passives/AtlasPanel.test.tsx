import { fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { Build, Variant } from '@/lib/build/model';
import { parseBuild } from '@/lib/build/parse-build';
import { TooltipProvider } from '@/ui/tooltip/Tooltip';
import { loadFixture } from '../../../tests/fixtures/load';
import { AtlasPanel } from './AtlasPanel';
import type { EmbedTree } from './PassivesPanel';

const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
const BUILD: Build = parseBuild(fixture.build, fixture.staticData);
const LOW_LIFE_INDEX = BUILD.variants.findIndex((v) => v.title === 'ENDGAME (LOW LIFE)');
const LOW_LIFE = BUILD.variants[LOW_LIFE_INDEX]!;

const treeFocus = { highlight: vi.fn(), clear: vi.fn(), select: vi.fn() };

function renderPanel(variant: Variant = LOW_LIFE, variantIndex = LOW_LIFE_INDEX) {
  treeFocus.highlight.mockClear();
  treeFocus.select.mockClear();
  const calls: Parameters<EmbedTree>[0][] = [];
  const embedTree: EmbedTree = (options) => {
    calls.push(options);
    return { setVariant: vi.fn(), sync: vi.fn(), destroy: vi.fn() };
  };
  render(
    <TooltipProvider>
      <AtlasPanel variant={variant} variantIndex={variantIndex} embedTree={embedTree} treeFocus={treeFocus} />
    </TooltipProvider>,
  );
  return calls;
}

describe('AtlasPanel', () => {
  it('lists the key atlas passives by subtree, with the points spent', () => {
    renderPanel();

    const expedition = screen.getByRole('list', { name: 'Expedition passives' });
    expect([...expedition.querySelectorAll('.passive-row__name')].map((el) => el.textContent)).toEqual(['Double or Nothing', 'Calculated Investment', 'Buried Ambition', 'Steady Development']);
    expect(screen.getByText('Expedition', { selector: '.passives__label' })).toBeTruthy();
    expect(screen.getByText('19 points')).toBeTruthy();
  });

  it('opens a tooltip for an atlas passive', () => {
    renderPanel();

    fireEvent.focus(within(screen.getByRole('list', { name: 'Expedition passives' })).getByText('Buried Ambition').closest('.tooltip-trigger')!);

    expect(screen.getByRole('tooltip').querySelector('.tooltip__title')?.textContent).toBe('Buried Ambition');
  });

  it("embeds the site's atlas tree for the variant", () => {
    const calls = renderPanel();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.kind).toBe('atlas-tree');
    expect(calls[0]!.variantIndex).toBe(LOW_LIFE_INDEX);
    expect(calls[0]!.placeholder).toBe(screen.getByRole('region', { name: 'Atlas tree' }).querySelector('.passives__stage'));
  });

  it("shows the atlas passives first, with the author's notes a click away", () => {
    const notes = { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Rush Strongboxes first', format: 0 }] }] } };
    renderPanel({ ...LOW_LIFE, atlasNotes: notes });

    const tabs = screen.getByRole('tablist', { name: 'Atlas side panel' });
    expect(within(tabs).getAllByRole('tab').map((tab) => [tab.textContent, tab.getAttribute('aria-selected')])).toEqual([
      ['Atlas', 'true'],
      ['Notes', 'false'],
    ]);
    expect(screen.getByRole('list', { name: 'Expedition passives' })).toBeTruthy();

    fireEvent.click(within(tabs).getByRole('tab', { name: "Author's notes" }));
    expect(screen.getByRole('tabpanel', { name: "Author's notes" }).textContent).toContain('Rush Strongboxes first');
  });

  it('shows just the key atlas passives when the author wrote no notes on the atlas', () => {
    renderPanel();

    expect(screen.queryByRole('tablist', { name: 'Atlas side panel' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Key Atlas Passives' })).toBeTruthy();
  });

  it("points the site's atlas tree at the node of the row under the pointer", () => {
    renderPanel();
    const row = within(screen.getByRole('list', { name: 'Expedition passives' })).getByText('Buried Ambition').closest('li')!;
    const slug = LOW_LIFE.atlas!.groups[0]!.passives.find((p) => p.name === 'Buried Ambition')!.nodeSlug;

    fireEvent.pointerEnter(row);
    fireEvent.click(row);

    expect(treeFocus.highlight).toHaveBeenCalledWith(slug);
    expect(treeFocus.select).toHaveBeenCalledWith(slug);
  });

  it('explains an atlas tree without notables or keystones', () => {
    renderPanel({ ...LOW_LIFE, atlas: { pointCount: 3, groups: [] } });

    expect(screen.getByText("The author hasn't taken atlas notables in this variant.")).toBeTruthy();
  });

  it('keeps the same layout for a variant without an atlas tree, saying the author has no suggestions yet', () => {
    const calls = renderPanel(BUILD.variants[0]!, 0);

    const tree = screen.getByRole('region', { name: 'Atlas tree' });
    expect(within(tree).getByRole('status').textContent).toBe("The site shows no atlas tree for this variant.");
    expect(screen.getByRole('heading', { level: 2, name: 'Key Atlas Passives' })).toBeTruthy();
    expect(screen.getByText("The author hasn't suggested atlas passives for this variant yet.")).toBeTruthy();
    expect(screen.queryByText(/points$/)).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
