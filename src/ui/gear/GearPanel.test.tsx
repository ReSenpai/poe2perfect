import { fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import type { Build, Variant } from '@/lib/build/model';
import { parseBuild } from '@/lib/build/parse-build';
import { TooltipProvider } from '@/ui/tooltip/Tooltip';
import { loadFixture, textNodes } from '../../../tests/fixtures/load';
import { GearPanel } from './GearPanel';

const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
const BUILD: Build = parseBuild(fixture.build, fixture.staticData);
const ENDGAME = BUILD.variants.find((v) => v.title === 'ENDGAME (FULL LIFE)')!;

function renderPanel(variant: Variant = ENDGAME) {
  return render(
    <TooltipProvider>
      <GearPanel variant={variant} entities={BUILD.entities} />
    </TooltipProvider>,
  );
}

function slotCard(label: string) {
  return screen.getAllByText(label, { selector: '.item-slot__label' })[0]!.closest('.item-slot') as HTMLElement;
}

describe('GearPanel', () => {
  it('lays out armour as large cards and the rest as a compact grid, without category headings', () => {
    const { container } = renderPanel();

    const labels = (selector: string) => [...container.querySelectorAll(`${selector} .item-slot__label`)].map((el) => el.textContent);
    expect(labels('.item-slot--large')).toEqual(['Helmet', 'Body Armour', 'Gloves', 'Boots', 'Belt']);
    expect(labels('.item-slot--compact')).toEqual(['Weapon', 'Offhand', 'Weapon · Set 2', 'Offhand · Set 2', 'Amulet', 'Ring 1', 'Ring 2', 'Life Flask', 'Mana Flask', 'Charm 1', 'Charm 2', 'Charm 3']);
    expect(container.querySelector('.item-slot--compact .item-slot__mods')).toBeNull();
    expect(screen.queryAllByRole('heading', { level: 3 })).toEqual([]);
  });

  it('keeps the belt with the armour and always shows the charms', () => {
    const { container } = renderPanel(BUILD.variants[0]!);

    const labels = (selector: string) => [...container.querySelectorAll(`${selector} .item-slot__label`)].map((el) => el.textContent);
    expect(labels('.gear__armour')).toEqual(['Helmet', 'Body Armour', 'Gloves', 'Boots', 'Belt']);
    expect(labels('.gear__other')).toContain('Charm 3');
  });

  it('shows standard slots the author left empty as placeholders', () => {
    const { container } = renderPanel({ ...ENDGAME, equipment: ENDGAME.equipment.filter((s) => s.slot === 'boots') });

    const empty = [...container.querySelectorAll('.item-slot--empty')];
    expect(empty.map((card) => card.querySelector('.item-slot__label')?.textContent)).toEqual([
      'Helmet',
      'Body Armour',
      'Gloves',
      'Belt',
      'Weapon',
      'Offhand',
      'Amulet',
      'Ring 1',
      'Ring 2',
      'Life Flask',
      'Mana Flask',
      'Charm 1',
      'Charm 2',
      'Charm 3',
    ]);
    expect(empty[0]?.textContent).toContain('Empty');
    expect(empty[0]?.closest('.tooltip-trigger')).toBeNull();
  });

  it('shows each item with its slot, rarity and sockets', () => {
    renderPanel();

    const helmet = slotCard('Helmet');
    const name = within(helmet).getByText("Atziri's Disdain");
    expect(name.classList.contains('item-name--unique')).toBe(true);
    expect(helmet.querySelector('.item-slot__icon')?.getAttribute('src')).toContain('AtzirisDisdain');
    expect(helmet.querySelectorAll('.item-slot__socket')).toHaveLength(1);
    expect(within(helmet).getByText(/maximum Mana/)).toBeTruthy();
  });

  it('opens the item tooltip from its slot card', () => {
    renderPanel();

    fireEvent.focus(slotCard('Helmet').closest('.tooltip-trigger')!);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain("Atziri's Disdain");
    expect(tooltip.textContent).toContain('Idol of Egrin');
  });

  it('shows the skill a weapon grants, with its own tooltip', () => {
    renderPanel();

    const weapon = slotCard('Weapon');
    expect(weapon.querySelector('.item-slot__grants')?.textContent).toBe('Chaos Bolt');

    fireEvent.focus(weapon.querySelector('.item-slot__grants')!.closest('.tooltip-trigger')!);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.querySelector('.tooltip__title')?.textContent).toBe('Chaos Bolt');
    expect(tooltip.querySelector('.tooltip__subtitle')?.textContent).toBe('Skill Gem');
  });

  it('offers the trade search of the site for an equipped item', () => {
    renderPanel();

    const trade = within(slotCard('Helmet')).getByRole('link', { name: "Find Atziri's Disdain on the trade site" });
    expect(trade.getAttribute('href')).toContain('https://www.pathofexile.com/trade2/search/');
    expect(trade.getAttribute('target')).toBe('_blank');
    expect(trade.getAttribute('rel')).toBe('noopener noreferrer');

  });

  it('has nothing to trade on a slot the author left empty', () => {
    const { container } = renderPanel({ ...ENDGAME, equipment: [] });

    expect(container.querySelector('.item-slot__trade')).toBeNull();
  });

  it('opens a tooltip for a rune socketed in an item', () => {
    renderPanel();

    fireEvent.focus(slotCard('Helmet').querySelector('.item-slot__socket')!.closest('.tooltip-trigger')!);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.querySelector('.tooltip__title')?.textContent).toBe('Idol of Egrin');
    expect(tooltip.textContent).toContain('Socketable');
  });

  it('lists the upgrade priority in order, with tooltips', () => {
    renderPanel();

    const list = screen.getByRole('list', { name: 'Gear priority' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('.priority__name')?.textContent).slice(0, 3)).toEqual(["Atziri's Disdain", 'Ingenuity', 'Withered Wand']);
    expect(rows[0]?.querySelector('.priority__number')?.textContent).toBe('1');
    expect(rows[1]?.querySelector('.priority__slot')?.textContent).toBe('Belt');

    fireEvent.focus(rows[1]!.querySelector('.tooltip-trigger')!);
    expect(screen.getByRole('tooltip').textContent).toContain('Ingenuity');
  });

  it("shows the author's gear notes below the gear and priority", () => {
    const { container } = renderPanel();

    const notes = screen.getByRole('heading', { level: 2, name: "Author's Notes" }).closest('section')!;
    const columns = container.querySelector('.gear__columns')!;
    expect(columns.contains(notes)).toBe(false);
    expect(columns.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notes.textContent).toContain(textNodes(ENDGAME.equipmentNotes)[0]);
  });

  it('explains a variant without equipment', () => {
    renderPanel({ ...ENDGAME, equipment: [], itemPriority: [], equipmentNotes: null });


    expect(screen.getByText("The author hasn't listed gear for this variant.")).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Gear priority' })).toBeNull();
  });
});
