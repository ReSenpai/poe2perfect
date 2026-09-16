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

function renderPanel(variant: Variant = LOW_LIFE, variantIndex = LOW_LIFE_INDEX, embed = fakeEmbed()) {
  const view = render(
    <TooltipProvider>
      <PassivesPanel variant={variant} variantIndex={variantIndex} entities={BUILD.entities} embedTree={embed.embedTree} />
    </TooltipProvider>,
  );
  return { ...view, embed };
}

const keyList = () => screen.getByRole('list', { name: 'Key passives' });
/** Notes open first when the author wrote any; these tests look at the key passives. */
const showKeyPassives = () => {
  const tab = screen.queryByRole('tab', { name: 'Key passives' });
  if (tab) fireEvent.click(tab);
};
const tree = () => screen.getByRole('region', { name: 'Passive tree' });

describe('PassivesPanel', () => {
  it('lists the key passives in the order the author takes them', () => {
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

    const ascendancy = screen.getByRole('list', { name: 'Ascendancy passives' });
    expect([...ascendancy.querySelectorAll('.passive-row__name')].map((el) => el.textContent)).toEqual(['Soulless Form', 'Eternal Life', 'Eldritch Empowerment']);
    expect(screen.getByText('96 points · 9 ascendancy')).toBeTruthy();
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

    expect(screen.queryByRole('list', { name: 'Ascendancy passives' })).toBeNull();
    expect(screen.getByText('20 points')).toBeTruthy();
  });

  it("opens the author's notes on the tree first, with the key passives a click away", () => {
    renderPanel(BUILD.variants[0], 0);

    const tabs = screen.getByRole('tablist', { name: 'Passives side panel' });
    // Short labels on screen; names that don't clash with the main "Passives" tab for assistive tech.
    expect(within(tabs).getAllByRole('tab').map((tab) => [tab.textContent, tab.getAttribute('aria-label'), tab.getAttribute('aria-selected')])).toEqual([
      ['Notes', "Author's notes", 'true'],
      ['Passives', 'Key passives', 'false'],
    ]);
    expect(screen.getByRole('tabpanel', { name: "Author's notes" }).textContent).toContain(textNodes(BUILD.variants[0]!.passiveNotes)[0]);
    expect(screen.queryByRole('list', { name: 'Key passives' })).toBeNull();

    fireEvent.click(within(tabs).getByRole('tab', { name: 'Key passives' }));

    expect(screen.getByRole('list', { name: 'Key passives' })).toBeTruthy();
  });

  it('opens tooltips for passives mentioned in the notes', () => {
    renderPanel(BUILD.variants[0], 0);

    const chip = within(screen.getByRole('tabpanel', { name: "Author's notes" })).getAllByText('Potent Incantation')[0]!.closest('.tooltip-trigger')!;
    fireEvent.focus(chip);

    expect(screen.getByRole('tooltip').querySelector('.tooltip__title')?.textContent).toBe('Potent Incantation');
  });

  it('shows just the key passives when the author wrote no notes on the tree', () => {
    renderPanel(variant('ACT 3'), BUILD.variants.indexOf(variant('ACT 3')));

    expect(screen.queryByRole('tablist', { name: 'Passives side panel' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Key Passives' })).toBeTruthy();
  });

  it('explains a variant without key passives', () => {
    renderPanel({ ...LOW_LIFE, passives: { ...LOW_LIFE.passives, keyPassives: [] } });
    showKeyPassives();

    expect(screen.getByText("The author hasn't picked key passives for this variant.")).toBeTruthy();
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
