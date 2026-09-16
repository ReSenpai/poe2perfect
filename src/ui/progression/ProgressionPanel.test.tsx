import { fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { Build } from '@/lib/build/model';
import { parseBuild } from '@/lib/build/parse-build';
import { TooltipProvider } from '@/ui/tooltip/Tooltip';
import { loadFixture, textNodes } from '../../../tests/fixtures/load';
import { ProgressionPanel } from './ProgressionPanel';

const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
const BUILD: Build = parseBuild(fixture.build, fixture.staticData);
const variant = (title: string) => BUILD.variants.find((v) => v.title === title)!;

function renderPanel(title = 'ENDGAME (FULL LIFE)', build = BUILD) {
  const onSelectVariant = vi.fn();
  const onOpenTab = vi.fn();
  render(
    <TooltipProvider>
      <ProgressionPanel build={build} variant={build.variants.find((v) => v.title === title) ?? build.variants[0]!} onSelectVariant={onSelectVariant} onOpenTab={onOpenTab} />
    </TooltipProvider>,
  );
  return { onSelectVariant, onOpenTab };
}

const stages = () => screen.getByRole('navigation', { name: 'Stages' });
const stage = () => screen.getByRole('region', { name: 'Stage' });
const group = (name: string) => within(stage()).getByRole('region', { name });
const rowNames = (element: HTMLElement, selector: string) => [...element.querySelectorAll(selector)].map((el) => el.textContent);

describe('ProgressionPanel', () => {
  it('lists the stages in the order of the guide, with the current one marked', () => {
    renderPanel();

    const buttons = within(stages()).getAllByRole('button');
    expect(buttons.map((button) => button.querySelector('.stage__title')?.textContent)).toEqual(BUILD.variants.map((v) => v.title));
    expect(buttons.map((button) => button.getAttribute('aria-current'))).toEqual([null, null, null, null, 'step', null]);
    expect(buttons[4]?.querySelector('.stage__meta')?.textContent).toBe('112 points');
    // Long titles are cut with an ellipsis; the full one stays available on hover.
    expect(buttons[4]?.getAttribute('title')).toBe('ENDGAME (FULL LIFE)');
  });

  it('opens another stage', () => {
    const { onSelectVariant } = renderPanel();

    fireEvent.click(within(stages()).getByRole('button', { name: /^ACT 2/ }));

    expect(onSelectVariant).toHaveBeenCalledWith(variant('ACT 2').id);
  });

  it("shows the stage with the author's description and what it changes from the previous one", () => {
    renderPanel();

    expect(within(stage()).getByRole('heading', { level: 2 }).textContent).toBe('ENDGAME (FULL LIFE)');
    expect(within(stage()).getByText('Changes from ACT 4 - Endgame')).toBeTruthy();
    // The changes come first; the author's description follows in a block of its own, styled like them.
    const notes = group("Author's Notes");
    expect(notes.classList.contains('stage-group')).toBe(true);
    expect(within(notes).getByRole('heading', { level: 3 }).textContent).toBe("Author's Notes");
    expect(notes.textContent).toContain(textNodes(variant('ENDGAME (FULL LIFE)').description)[0]);
    const groups = stage().querySelector('.stage-groups')!;
    expect(groups.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('leaves out the notes block for a stage without a description', () => {
    renderPanel('ACT 1', { ...BUILD, variants: BUILD.variants.map((v) => ({ ...v, description: null })) });

    expect(within(stage()).queryByRole('region', { name: "Author's Notes" })).toBeNull();
  });

  it('calls the first stage the starting point', () => {
    renderPanel('ACT 1');

    expect(within(stage()).getByText('Starting point')).toBeTruthy();
  });

  it('lists skills and supports that come and go', () => {
    renderPanel('ACT 2');

    const skills = group('Skills');
    expect(rowNames(skills, '.change--removed .change__name')).toEqual(['Unearth', 'Volcano']);
    expect(rowNames(skills, '.change--added .change__name')).toEqual(['Living Lightning']);
  });

  it('lists the gear that changes, slot by slot', () => {
    renderPanel();

    const first = group('Gear').querySelector('.gear-change')!;
    expect(first.querySelector('.gear-change__slot')?.textContent).toBe('Helmet');
    expect(first.querySelector('.gear-change__from')?.textContent).toBe('Beaded Circlet');
    expect(first.querySelector('.gear-change__to .change__name')?.textContent).toBe("Atziri's Disdain");
  });

  it('says when a part of the build stays the same', () => {
    renderPanel('ACT 2');

    expect(within(group('Gear')).getByText('No changes')).toBeTruthy();
  });

  it('sums up the passive points and the key passives taken', () => {
    renderPanel();

    const passives = group('Passives');
    expect(passives.querySelector('.stage-points')?.textContent).toBe('112 points (+31) · 8 ascendancy (+4)');
    expect(rowNames(passives, '.change--added .change__name')).toEqual(['Eldritch Empowerment', 'Dampening Shield', 'Melding', 'Insightfulness', 'Zone of Control', 'Efficient Casting', 'Roil', 'Ingenuity', 'Convalescence', 'Dependable Ward']);
  });

  it('opens the tab behind each part of the stage', () => {
    const { onOpenTab } = renderPanel();

    fireEvent.click(within(group('Gear')).getByRole('button', { name: 'Open Gear' }));
    fireEvent.click(within(group('Passives')).getByRole('button', { name: 'Open Passives' }));

    expect(onOpenTab.mock.calls).toEqual([['gear'], ['passives']]);
  });

  it('opens tooltips for what changes', () => {
    renderPanel();

    fireEvent.focus(within(group('Skills')).getByText('Chaos Bolt').closest('.tooltip-trigger')!);
    expect(screen.getByRole('tooltip').querySelector('.tooltip__title')?.textContent).toBe('Chaos Bolt');

    fireEvent.focus(within(group('Gear')).getByText("Atziri's Disdain").closest('.tooltip-trigger')!);
    expect(screen.getByRole('tooltip').querySelector('.tooltip__title')?.textContent).toBe("Atziri's Disdain");
  });

  it('lists the quest rewards the author took, by act', () => {
    renderPanel();

    const quests = screen.getByRole('region', { name: 'Quest rewards' });
    expect(rowNames(quests, '.quests__act')).toEqual(['Act 2', 'Act 3', 'Act 4', 'Interlude']);
    const medallion = within(quests).getByText('Medallion').closest('li')!;
    expect(medallion.querySelector('.quest__reward')?.textContent).toBe('30% increased Charm Charges gained, +1 Charm Slot');
    expect(medallion.querySelector('.quest__area')?.textContent).toBe('Valley of the Titans');
    expect(within(medallion).getByText('Choice')).toBeTruthy();
    expect(medallion.querySelector('.quest__name')?.getAttribute('title')).toBe('Medallion');
  });

  it('leaves out quest rewards when the author picked none', () => {
    renderPanel('ACT 1', { ...BUILD, questRewards: [] });

    expect(screen.queryByRole('region', { name: 'Quest rewards' })).toBeNull();
  });
});
