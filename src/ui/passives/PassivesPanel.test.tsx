import { act, fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { Build, Variant } from '@/lib/build/model';
import { parseBuild } from '@/lib/build/parse-build';
import type { TreeEmbedStatus } from '@/lib/passives/tree-embed';
import { TooltipProvider } from '@/ui/tooltip/Tooltip';
import { loadFixture, textNodes } from '../../../tests/fixtures/load';
import { type EmbedTree, PassivesPanel } from './PassivesPanel';

const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
const BUILD: Build = parseBuild(fixture.build, fixture.staticData);
const LOW_LIFE_INDEX = BUILD.variants.findIndex((v) => v.title === 'ENDGAME (LOW LIFE)');
const LOW_LIFE = BUILD.variants[LOW_LIFE_INDEX]!;
const variant = (title: string) => BUILD.variants.find((v) => v.title === title)!;

function fakeEmbed() {
  const calls: Parameters<EmbedTree>[0][] = [];
  const handle = { setVariant: vi.fn(), sync: vi.fn(), destroy: vi.fn() };
  const embedTree: EmbedTree = (options) => {
    calls.push(options);
    return handle;
  };
  return { embedTree, calls, handle, status: (status: TreeEmbedStatus) => act(() => calls[0]!.onStatus(status)) };
}

const fakeFocus = () => ({ highlight: vi.fn(), clear: vi.fn(), select: vi.fn() });
let treeFocus = fakeFocus();

function renderPanel(variant: Variant = LOW_LIFE, variantIndex = LOW_LIFE_INDEX, embed = fakeEmbed()) {
  treeFocus = fakeFocus();
  const view = render(
    <TooltipProvider>
      <PassivesPanel variant={variant} variantIndex={variantIndex} entities={BUILD.entities} embedTree={embed.embedTree} treeFocus={treeFocus} />
    </TooltipProvider>,
  );
  return { ...view, embed, treeFocus };
}

const keyList = () => screen.getByRole('list', { name: 'Passive priority' });
/** The priority list opens first; these tests look at it. */
const showKeyPassives = () => {
  const tab = screen.queryByRole('tab', { name: 'Passive priority' });
  if (tab) fireEvent.click(tab);
};
const tree = () => screen.getByRole('region', { name: 'Passive tree' });

describe('PassivesPanel', () => {
  it('lists the passives in the order the author takes them', () => {
    renderPanel();
    showKeyPassives();

    const rows = within(keyList()).getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('.passive-row__name')?.textContent)).toEqual(LOW_LIFE.passives.keyPassives.map((p) => p.name));
    expect(rows[0]?.querySelector('.passive-row__number')?.textContent).toBe('1');
    expect(rows[0]?.querySelector('.passive-row__effect')?.textContent).toBe(LOW_LIFE.passives.keyPassives[0]!.effects[0]);
  });

  it('marks keystones apart from notables', () => {
    renderPanel();
    showKeyPassives();

    const keystone = within(keyList()).getByText('Whispers of Doom').closest('li')!;
    expect(keystone.classList.contains('passive-row--keystone')).toBe(true);
  });

  it('lists the ascendancy notables and the points spent', () => {
    renderPanel();
    showKeyPassives();

    const ascendancy = screen.getByRole('list', { name: 'Ascendancy priority' });
    expect([...ascendancy.querySelectorAll('.passive-row__name')].map((el) => el.textContent)).toEqual(['Soulless Form', 'Eternal Life', 'Eldritch Empowerment']);
    // The ascendancy is a priority order too, so its rows are numbered like the tree's.
    expect([...ascendancy.querySelectorAll('.passive-row__number')].map((el) => el.textContent)).toEqual(['1', '2', '3']);
    expect(screen.getByText('96 points · 8 ascendancy')).toBeTruthy();
  });

  it('points the tree at a passive the pointer or the keyboard is on', () => {
    renderPanel();
    showKeyPassives();
    const row = within(keyList()).getByText('Pure Energy').closest('li')!;
    const slug = LOW_LIFE.passives.keyPassives.find((p) => p.name === 'Pure Energy')!.nodeSlug;

    fireEvent.pointerEnter(row);
    expect(treeFocus.highlight).toHaveBeenCalledWith(slug);

    fireEvent.pointerLeave(row);
    expect(treeFocus.clear).toHaveBeenCalled();

    fireEvent.focusIn(row.querySelector('.tooltip-trigger')!);
    expect(treeFocus.highlight).toHaveBeenCalledTimes(2);
  });

  it("passes a click on a passive to the site's tree", () => {
    renderPanel();
    showKeyPassives();
    const row = within(keyList()).getByText('Pure Energy').closest('li')!;
    const slug = LOW_LIFE.passives.keyPassives.find((p) => p.name === 'Pure Energy')!.nodeSlug;

    fireEvent.click(row);
    fireEvent.keyDown(row.querySelector('.tooltip-trigger')!, { key: 'Enter' });

    expect(treeFocus.select).toHaveBeenCalledTimes(2);
    expect(treeFocus.select).toHaveBeenLastCalledWith(slug);
  });

  it('opens a tooltip for a key passive', () => {
    renderPanel();
    showKeyPassives();

    fireEvent.focus(within(keyList()).getByText('Pure Energy').closest('.tooltip-trigger')!);

    expect(screen.getByRole('tooltip').querySelector('.tooltip__title')?.textContent).toBe('Pure Energy');
  });

  it('leaves out the ascendancy before the build has one', () => {
    renderPanel(BUILD.variants[0], 0);
    showKeyPassives();

    expect(screen.queryByRole('list', { name: 'Ascendancy priority' })).toBeNull();
    expect(screen.getByText('20 points')).toBeTruthy();
  });

  it("opens the priority list first, with the author's notes a click away", () => {
    renderPanel(BUILD.variants[0], 0);

    const tabs = screen.getByRole('tablist', { name: 'Passives side panel' });
    // Short labels on screen; names that don't clash with the main "Passives" tab for assistive tech.
    expect(within(tabs).getAllByRole('tab').map((tab) => [tab.textContent, tab.getAttribute('aria-label'), tab.getAttribute('aria-selected')])).toEqual([
      ['Priority', 'Passive priority', 'true'],
      ['Notes', "Author's notes", 'false'],
    ]);
    expect(screen.getByRole('list', { name: 'Passive priority' })).toBeTruthy();

    fireEvent.click(within(tabs).getByRole('tab', { name: "Author's notes" }));

    expect(screen.getByRole('tabpanel', { name: "Author's notes" }).textContent).toContain(textNodes(BUILD.variants[0]!.passiveNotes)[0]);
    expect(screen.queryByRole('list', { name: 'Passive priority' })).toBeNull();
  });

  it('opens tooltips for passives mentioned in the notes', () => {
    renderPanel(BUILD.variants[0], 0);
    fireEvent.click(screen.getByRole('tab', { name: "Author's notes" }));

    const chip = within(screen.getByRole('tabpanel', { name: "Author's notes" })).getAllByText('Potent Incantation')[0]!.closest('.tooltip-trigger')!;
    fireEvent.focus(chip);

    expect(screen.getByRole('tooltip').querySelector('.tooltip__title')?.textContent).toBe('Potent Incantation');
  });

  it('shows just the priority list when the author wrote no notes on the tree', () => {
    renderPanel(variant('ACT 3'), BUILD.variants.indexOf(variant('ACT 3')));

    expect(screen.queryByRole('tablist', { name: 'Passives side panel' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Priority' })).toBeTruthy();
  });

  it('explains a variant without a passive priority', () => {
    renderPanel({ ...LOW_LIFE, passives: { ...LOW_LIFE.passives, keyPassives: [] } });
    showKeyPassives();

    expect(screen.getByText("The author hasn't set an order for the passives of this variant.")).toBeTruthy();
  });

  it("embeds the site's tree for the variant into the tree area", () => {
    const { embed } = renderPanel();

    expect(embed.calls).toHaveLength(1);
    expect(embed.calls[0]!.placeholder).toBe(tree().querySelector('.passives__stage'));
    expect(embed.calls[0]!.variantIndex).toBe(LOW_LIFE_INDEX);
    expect(embed.calls[0]!.kind).toBe('passive-tree');
  });

  it('says what the tree is doing until it is shown', () => {
    const { embed } = renderPanel();

    embed.status('loading');
    expect(within(tree()).getByRole('status').textContent).toBe('Loading the passive tree…');

    embed.status('ready');
    expect(within(tree()).queryByRole('status')).toBeNull();

    embed.status('missing');
    expect(within(tree()).getByRole('status').textContent).toBe("The site didn't show a passive tree for this build.");
  });

  it('switches the embedded tree to another variant instead of embedding it again', () => {
    const embed = fakeEmbed();
    const { rerender } = renderPanel(LOW_LIFE, LOW_LIFE_INDEX, embed);

    rerender(
      <TooltipProvider>
        <PassivesPanel variant={BUILD.variants[0]!} variantIndex={0} entities={BUILD.entities} embedTree={embed.embedTree} />
      </TooltipProvider>,
    );

    expect(embed.calls).toHaveLength(1);
    expect(embed.handle.setVariant).toHaveBeenCalledWith(0);
  });

  it('gives the tree back to the site when closed', () => {
    const { unmount, embed } = renderPanel();

    unmount();

    expect(embed.handle.destroy).toHaveBeenCalledTimes(1);
  });
});
