import { fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { Build, Variant } from '@/lib/build/model';
import { parseBuild } from '@/lib/build/parse-build';
import { TooltipProvider } from '@/ui/tooltip/Tooltip';
import { loadFixture } from '../../../tests/fixtures/load';
import { SkillsPanel } from './SkillsPanel';

const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
const BUILD: Build = parseBuild(fixture.build, fixture.staticData);
const ENDGAME = BUILD.variants.find((v) => v.title === 'ENDGAME (FULL LIFE)')!;

function renderPanel(variant: Variant = ENDGAME, copy = vi.fn(async () => true)) {
  const view = render(
    <TooltipProvider>
      <SkillsPanel variant={variant} entities={BUILD.entities} copy={copy} />
    </TooltipProvider>,
  );
  return { ...view, copy };
}

const skillList = () => screen.getByRole('list', { name: 'Active skills' });
const skillButton = (name: string) => within(skillList()).getByRole('button', { name: new RegExp(`^${name}`) });
const details = () => screen.getByRole('region', { name: 'Skill details' });

describe('SkillsPanel', () => {
  // The gem name is what you paste into the game's own search.
  it('copies the name of an active skill, and says it did', async () => {
    const { copy } = renderPanel();

    fireEvent.click(skillButton('Contagion'));

    expect(copy).toHaveBeenCalledWith('Contagion');
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Copied “Contagion”');
  });

  it('copies the name of a support gem from its socket', () => {
    const { copy } = renderPanel();

    const row = skillButton('Essence Drain').closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Copy “Chain II”' }));

    expect(copy).toHaveBeenCalledWith('Chain II');
  });

  it('copies the name of a gem from the priority list', () => {
    const { copy } = renderPanel();

    const first = within(screen.getByRole('list', { name: 'Gem priority' })).getAllByRole('listitem')[0]!;
    const name = first.querySelector('.gem-priority__name')!.textContent;
    fireEvent.click(within(first).getByRole('button', { name: `Copy “${name}”` }));

    expect(copy).toHaveBeenCalledWith(name);
  });

  it('copies the name of the gem shown in the details, and of its supports', () => {
    const { copy } = renderPanel();

    fireEvent.click(within(details()).getByRole('button', { name: 'Copy “Essence Drain”' }));
    expect(copy).toHaveBeenCalledWith('Essence Drain');

    fireEvent.click(within(details()).getByRole('button', { name: 'Copy “Chain II”' }));
    expect(copy).toHaveBeenLastCalledWith('Chain II');
  });

  it('says when the browser would not let it copy', async () => {
    renderPanel(ENDGAME, vi.fn(async () => false));

    fireEvent.click(skillButton('Contagion'));

    expect((await screen.findByRole('status')).textContent).toBe("Couldn't copy the name");
  });

  it('lists the active skills with their tags, the first one selected', () => {
    renderPanel();

    const buttons = [...skillList().querySelectorAll('.skill-row__main')];
    expect(buttons.map((b) => b.querySelector('.skill-row__name')?.textContent)).toEqual(ENDGAME.skills.map((s) => s.gem.name));
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1]?.getAttribute('aria-pressed')).toBe('false');
    expect(buttons[0]?.querySelector('.skill-row__tags')?.textContent).toBe('Spell · Projectile · Chaos · Duration · Repeatable');
  });

  it('shows support gem icons on each row, with tooltips', () => {
    renderPanel();

    const row = skillButton('Essence Drain').closest('li')!;
    const supports = row.querySelectorAll('.skill-row__support');
    expect(supports).toHaveLength(5);

    fireEvent.focus(supports[0]!.closest('.tooltip-trigger')!);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.querySelector('.tooltip__title')?.textContent).toBe('Chain II');
    expect(tooltip.textContent).toContain('Support Gem');
  });

  it('describes the selected skill', () => {
    renderPanel();

    const panel = within(details());
    expect(panel.getByRole('heading', { level: 2, name: 'Essence Drain' })).toBeTruthy();
    expect(panel.getByText('Mana Range')).toBeTruthy();
    expect(panel.queryByText('Cast Time')).toBeNull();
    expect(details().textContent).toContain('Requires: Level');
    expect(details().querySelector('.skill-details__description')?.textContent).toMatch(/\w+/);
    expect(details().querySelectorAll('.skill-details__effects li').length).toBeGreaterThan(0);
    expect([...details().querySelectorAll('.skill-details__support-name')].map((el) => el.textContent)).toEqual([
      'Chain II',
      'Swift Affliction II',
      'Rapid Casting II',
      'Intense Agony',
      'Chaos Mastery',
    ]);
  });

  it('switches the details to a clicked skill', () => {
    renderPanel();

    fireEvent.click(skillButton('Contagion'));

    expect(skillButton('Contagion').getAttribute('aria-pressed')).toBe('true');
    expect(within(details()).getByRole('heading', { level: 2, name: 'Contagion' })).toBeTruthy();
    expect(details().querySelector('.skill-details__tags')?.textContent).toContain('Duration');
  });

  it('shows the attributes the gems require', () => {
    renderPanel();

    expect(screen.getByText('Str 20 · Dex 25 · Int 100')).toBeTruthy();
  });

  it('lists the gem priority in order, with the skill each gem supports', () => {
    renderPanel();

    const rows = within(screen.getByRole('list', { name: 'Gem priority' })).getAllByRole('listitem');
    expect(rows).toHaveLength(ENDGAME.gemPriority.length);
    expect(rows[0]?.querySelector('.gem-priority__number')?.textContent).toBe('1');
    expect(rows[0]?.querySelector('.gem-priority__name')?.textContent).toBe('Chain II');
    expect(rows[0]?.querySelector('.gem-priority__parent')?.textContent).toBe('Essence Drain');

    fireEvent.focus(rows[0]!.querySelector('.tooltip-trigger')!);
    expect(screen.getByRole('tooltip').querySelector('.tooltip__title')?.textContent).toBe('Chain II');
  });

  it('highlights the priority entries of the selected skill', () => {
    renderPanel();
    const current = () =>
      [...screen.getByRole('list', { name: 'Gem priority' }).querySelectorAll('.gem-priority__row--current .gem-priority__parent')].map((el) => el.textContent);

    expect(new Set(current())).toEqual(new Set(['Essence Drain']));

    fireEvent.click(skillButton('Contagion'));
    expect(new Set(current())).toEqual(new Set(['Contagion']));
  });

  it('marks the support in Active Skills while the pointer rests on its gem priority entry', () => {
    renderPanel();
    const row = within(screen.getByRole('list', { name: 'Gem priority' })).getAllByRole('listitem')[0]!;
    const marks = () =>
      [...screen.getByRole('list', { name: 'Active skills' }).querySelectorAll('.skill-row__support--match')].map(
        (icon) => [icon.closest('.skill-row')!.querySelector('.skill-row__name')!.textContent, icon.getAttribute('src')],
      );

    fireEvent.pointerEnter(row);
    // Chain II belongs to Essence Drain: only that row's socket lights up, even if another skill uses the same support.
    expect(marks()).toEqual([['Essence Drain', ENDGAME.gemPriority[0]!.gem.iconUrl]]);

    fireEvent.pointerLeave(row);
    expect(marks()).toEqual([]);
  });

  it('marks the skill itself for a priority entry that is an active skill', () => {
    const skill = ENDGAME.skills[1]!;
    renderPanel({ ...ENDGAME, gemPriority: [{ gem: skill.gem, parentSlug: null, parentName: null }] });
    const row = within(screen.getByRole('list', { name: 'Gem priority' })).getAllByRole('listitem')[0]!;

    fireEvent.focusIn(row);

    const marked = screen.getByRole('list', { name: 'Active skills' }).querySelectorAll('.skill-row--match');
    expect([...marked].map((el) => el.querySelector('.skill-row__name')?.textContent)).toEqual([skill.gem.name]);
  });

  it('leaves out the gem priority when the author set none', () => {
    renderPanel({ ...ENDGAME, gemPriority: [] });

    expect(screen.queryByRole('list', { name: 'Gem priority' })).toBeNull();
  });

  it("shows the author's skill notes below the skills", () => {
    const { container } = renderPanel();

    const notes = screen.getByRole('heading', { level: 2, name: "Author's Notes" }).closest('section')!;
    expect(container.querySelector('.skills__columns')!.contains(notes)).toBe(false);
  });

  it('explains a gem without static data', () => {
    const bare: Variant = { ...ENDGAME, skills: ENDGAME.skills.map((s) => ({ gem: { ...s.gem, details: null }, supports: [] })) };
    renderPanel(bare);

    expect(within(details()).getByText('No details available for this gem.')).toBeTruthy();
  });

  it('explains a variant without skills', () => {
    renderPanel({ ...ENDGAME, skills: [], gemRequirements: null, skillNotes: null });

    expect(screen.getByText("The author hasn't listed skills for this variant.")).toBeTruthy();
  });
});
