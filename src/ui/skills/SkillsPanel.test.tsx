import { fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import type { Build, Variant } from '@/lib/build/model';
import { parseBuild } from '@/lib/build/parse-build';
import { TooltipProvider } from '@/ui/tooltip/Tooltip';
import { loadFixture } from '../../../tests/fixtures/load';
import { SkillsPanel } from './SkillsPanel';

const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
const BUILD: Build = parseBuild(fixture.build, fixture.staticData);
const ENDGAME = BUILD.variants.find((v) => v.title === 'ENDGAME (FULL LIFE)')!;

function renderPanel(variant: Variant = ENDGAME) {
  return render(
    <TooltipProvider>
      <SkillsPanel variant={variant} entities={BUILD.entities} />
    </TooltipProvider>,
  );
}

const skillList = () => screen.getByRole('list', { name: 'Active skills' });
const skillButton = (name: string) => within(skillList()).getByRole('button', { name: new RegExp(`^${name}`) });
const details = () => screen.getByRole('region', { name: 'Skill details' });

describe('SkillsPanel', () => {
  it('lists the active skills with their tags, the first one selected', () => {
    renderPanel();

    const buttons = within(skillList()).getAllByRole('button');
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
