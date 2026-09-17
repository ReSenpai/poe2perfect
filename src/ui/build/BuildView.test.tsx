import { fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { Build } from '@/lib/build/model';
import { parseBuild } from '@/lib/build/parse-build';
import { loadFixture, textNodes } from '../../../tests/fixtures/load';
import type { TabId } from '@/lib/ui/route';
import { BuildView } from './BuildView';

const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
const BUILD: Build = parseBuild(fixture.build, fixture.staticData);

function renderView(initialHash = '', build = BUILD, headerCollapsed = false, defaultTab?: TabId) {
  const onRouteChange = vi.fn();
  const onOriginal = vi.fn();
  const onHeaderCollapsedChange = vi.fn();
  const onTabChange = vi.fn();
  const view = render(
    <BuildView
      build={build}
      initialHash={initialHash}
      onRouteChange={onRouteChange}
      onOriginal={onOriginal}
      headerCollapsed={headerCollapsed}
      onHeaderCollapsedChange={onHeaderCollapsedChange}
      defaultTab={defaultTab}
      onTabChange={onTabChange}
    />,
  );
  return { ...view, onRouteChange, onOriginal, onHeaderCollapsedChange, onTabChange };
}

const selectedTab = () => screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent;

describe('BuildView header', () => {
  it('shows the build identity and meta', () => {
    const { container } = renderView();

    expect(screen.getByRole('heading', { level: 1, name: 'ED Contagion Lich League Starter (Level 1 to Endgame)' })).toBeTruthy();
    const header = within(container.querySelector('header')!);
    expect(header.getByText('Witch')).toBeTruthy();
    expect(header.getByText('Lich')).toBeTruthy();
    expect(header.getByText('0.5.5')).toBeTruthy();
    expect(header.getByText('End Game · Starter · Speed Leveling')).toBeTruthy();
    expect(header.getByText('DEADRABB1T')).toBeTruthy();
    expect(container.querySelector('header img')?.getAttribute('src')).toBe(BUILD.headerImageUrl);
  });

  it('teases the build with the start of its overview', () => {
    const { container } = renderView();

    // The teaser is cut short, so compare its opening words.
    const opening = textNodes(BUILD.sections[0]!.content)[0]!.split(' ').slice(0, 6).join(' ');
    expect(container.querySelector('header')!.textContent).toContain(opening);
  });

  it('keeps the header informational, with the page controls in the tab bar', () => {
    const { container, onOriginal, onHeaderCollapsedChange } = renderView();

    expect(within(container.querySelector('header')!).queryAllByRole('button')).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Show original page' }));
    expect(onOriginal).toHaveBeenCalledOnce();

    const toggle = screen.getByRole('button', { name: 'Collapse header' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(onHeaderCollapsedChange).toHaveBeenCalledWith(true);
  });

  it('hides the header when collapsed, keeping a short title in the tab bar', () => {
    const { container, onHeaderCollapsedChange, onOriginal } = renderView('', BUILD, true);

    expect(container.querySelector('header')).toBeNull();
    expect(container.querySelector('.tab-bar__title')?.textContent).toBe(BUILD.title);

    fireEvent.click(screen.getByRole('button', { name: 'Show original page' }));
    expect(onOriginal).toHaveBeenCalledOnce();

    const toggle = screen.getByRole('button', { name: 'Expand header' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(onHeaderCollapsedChange).toHaveBeenCalledWith(false);
  });

  it('copes with a build without image, class or overview', () => {
    renderView('', { ...BUILD, headerImageUrl: null, className: null, ascendancy: null, sections: [], buildTypes: [], author: null });

    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(document.querySelector('header img')).toBeNull();
  });
});

describe('BuildView tabs', () => {
  it('lists the tabs and opens the overview by default', () => {
    renderView();

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Overview', 'Skills', 'Gear', 'Passives', 'Atlas Tree', 'Progression']);
    expect(selectedTab()).toBe('Overview');
    expect(screen.getByRole('tabpanel', { name: 'Overview' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Build Overview' })).toBeTruthy();
  });

  it('opens the default tab when the hash names none, reporting tab changes but not variant changes', () => {
    const { onTabChange } = renderView('', BUILD, false, 'gear');
    expect(selectedTab()).toBe('Gear');

    fireEvent.click(within(screen.getByRole('group', { name: 'Build variant' })).getByRole('button', { name: 'ACT 2' }));
    expect(onTabChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: 'Skills' }));
    expect(onTabChange).toHaveBeenCalledWith('skills');
  });

  it('explains variant tabs for a build without variants', () => {
    renderView('#skills', { ...BUILD, variants: [], defaultVariantId: null });

    expect(screen.getByText("The author hasn't added build variants yet.")).toBeTruthy();
  });

  it('warns quietly when the game data could not be loaded', () => {
    renderView('', { ...BUILD, hasStaticData: false });

    const warning = screen.getByRole('img', { name: 'Game data unavailable' });
    expect(warning.closest('[title]')?.getAttribute('title')).toBe('Game data could not be loaded: some names, icons and tooltips are missing. Reload the page to try again.');
  });

  it('shows no warning when the game data is there', () => {
    renderView();

    expect(screen.queryByRole('img', { name: 'Game data unavailable' })).toBeNull();
  });

  it('opens the tab from the initial hash', () => {
    renderView('#gear_endgame-full-life');

    expect(selectedTab()).toBe('Gear');
  });

  it('selects a clicked tab and reports the route with the current variant', () => {
    const { onRouteChange } = renderView('#passives_endgame-full-life');

    fireEvent.click(screen.getByRole('tab', { name: 'Skills' }));

    expect(selectedTab()).toBe('Skills');
    expect(onRouteChange).toHaveBeenLastCalledWith('#skills_endgame-full-life');
  });

  it('moves between tabs with arrow keys, wrapping around', () => {
    renderView();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Overview' }), { key: 'ArrowLeft' });
    expect(selectedTab()).toBe('Progression');
    expect(document.activeElement?.textContent).toBe('Progression');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Progression' }), { key: 'ArrowRight' });
    expect(selectedTab()).toBe('Overview');
  });

  it('picks the variant on variant tabs, reporting it in the route', () => {
    const { onRouteChange } = renderView('#gear');

    const picker = screen.getByRole('group', { name: 'Build variant' });
    expect(within(picker).getByRole('button', { name: 'ACT 1' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(within(picker).getByRole('button', { name: 'ENDGAME (FULL LIFE)' }));

    expect(onRouteChange).toHaveBeenLastCalledWith('#gear_endgame-full-life');
    expect(screen.getAllByText("Atziri's Disdain").length).toBeGreaterThan(0);
  });

  it('shows the skills of the variant and starts from the first skill after switching variants', () => {
    renderView('#skills_endgame-full-life');
    const pressed = () => within(screen.getByRole('list', { name: 'Active skills' })).getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true');

    fireEvent.click(within(screen.getByRole('list', { name: 'Active skills' })).getByRole('button', { name: /^Contagion/ }));
    expect(pressed()?.querySelector('.skill-row__name')?.textContent).toBe('Contagion');

    fireEvent.click(within(screen.getByRole('group', { name: 'Build variant' })).getByRole('button', { name: 'ACT 1' }));
    expect(pressed()?.querySelector('.skill-row__name')?.textContent).toBe(BUILD.variants[0]!.skills[0]!.gem.name);
  });

  it('shows the key passives of the variant on the Passives tab, filling the panel', () => {
    const { container } = renderView('#passives_endgame-low-life');

    const names = [...screen.getByRole('list', { name: 'Passive priority' }).querySelectorAll('.passive-row__name')].map((el) => el.textContent);
    expect(names[0]).toBe(BUILD.variants.find((v) => v.title === 'ENDGAME (LOW LIFE)')!.passives.keyPassives[0]!.name);
    expect(screen.getByRole('region', { name: 'Passive tree' })).toBeTruthy();
    expect(container.querySelector('.build-view__panel')?.classList.contains('build-view__panel--fill')).toBe(true);
  });

  it('leaves out the Atlas Tree tab for a build without an atlas tree', () => {
    const pathfinder = loadFixture('dreamcore-gas-grenade-pathfinder');
    renderView('#atlas', parseBuild(pathfinder.build, pathfinder.staticData));

    expect(screen.queryByRole('tab', { name: 'Atlas Tree' })).toBeNull();
    expect(selectedTab()).toBe('Overview');
  });

  it('shows the key atlas passives of the variant on the Atlas Tree tab', () => {
    const { container } = renderView('#atlas_endgame-low-life');

    const names = [...screen.getByRole('list', { name: 'Expedition passives' }).querySelectorAll('.passive-row__name')].map((el) => el.textContent);
    expect(names).toEqual(['Double or Nothing', 'Calculated Investment', 'Buried Ambition', 'Steady Development']);
    expect(screen.getByRole('region', { name: 'Atlas tree' })).toBeTruthy();
    expect(container.querySelector('.build-view__panel')?.classList.contains('build-view__panel--fill')).toBe(true);
  });

  it("explains a variant without an atlas tree on the Atlas Tree tab", () => {
    renderView('#atlas_act-1');

    expect(screen.getByText("The author hasn't suggested atlas passives for this variant yet.")).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Atlas tree' })).toBeTruthy();
  });

  it('picks the stage on the Progression tab from its own stage list instead of the variant chips', () => {
    const { onRouteChange } = renderView('#progression_act-1');

    expect(screen.queryByRole('group', { name: 'Build variant' })).toBeNull();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Stages' })).getByRole('button', { name: /^ACT 2/ }));

    expect(onRouteChange).toHaveBeenLastCalledWith('#progression_act-2');
    expect(within(screen.getByRole('region', { name: 'Stage' })).getByRole('heading', { level: 2 }).textContent).toBe('ACT 2');
  });

  it('opens a tab for the stage from the Progression tab', () => {
    const { onRouteChange } = renderView('#progression_act-2');

    fireEvent.click(screen.getByRole('button', { name: 'Open Skills' }));

    expect(selectedTab()).toBe('Skills');
    expect(onRouteChange).toHaveBeenLastCalledWith('#skills_act-2');
  });

  it('shows no variant picker on tabs about the whole build', () => {
    renderView('#overview');

    expect(screen.queryByRole('group', { name: 'Build variant' })).toBeNull();
  });

  it('keeps only the selected tab focusable', () => {
    renderView('#skills');

    expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1', '-1', '-1']);
  });

  it('switches tabs with number keys', () => {
    renderView();

    fireEvent.keyDown(document, { key: '3' });
    expect(selectedTab()).toBe('Gear');

    fireEvent.keyDown(document, { key: '6' });
    expect(selectedTab()).toBe('Progression');
  });

  it('ignores number keys with modifiers or while typing', () => {
    renderView();
    const input = document.body.appendChild(document.createElement('input'));

    fireEvent.keyDown(document, { key: '2', ctrlKey: true });
    fireEvent.keyDown(input, { key: '4' });
    fireEvent.keyDown(document, { key: '9' });

    expect(selectedTab()).toBe('Overview');
    input.remove();
  });

  it('stops listening to number keys when unmounted', () => {
    const { unmount, onRouteChange } = renderView();
    unmount();

    fireEvent.keyDown(document, { key: '2' });

    expect(onRouteChange).not.toHaveBeenCalled();
  });
});
