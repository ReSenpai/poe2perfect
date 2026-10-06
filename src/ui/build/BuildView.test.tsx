import { act, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'preact';
import type { Build } from '@/lib/build/model';
import { parseBuild } from '@/lib/build/parse-build';
import { loadFixture, textNodes } from '../../../tests/fixtures/load';
import type { TabId } from '@/lib/ui/route';
import { AUTHOR_ID, commentsPayload, rawComment, resourceIdOf } from '../../../tests/fixtures/comments';
import { createCommentsController } from '@/lib/comments/controller';
import { parseCommentsPayload } from '@/lib/comments/parse-comments';
import { BuildView } from './BuildView';

const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
const BUILD: Build = parseBuild(fixture.build, fixture.staticData);

function renderView(
  initialHash = '',
  build = BUILD,
  headerCollapsed = false,
  defaultTab?: TabId,
  overrides: Partial<ComponentProps<typeof BuildView>> = {},
) {
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
      {...overrides}
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

describe('BuildView variants', () => {
  it('opens the variant the visitor last read, and reports every pick so it can be remembered', () => {
    const onVariantChange = vi.fn();
    const second = BUILD.variants[1]!;
    renderView('#gear', BUILD, false, undefined, { defaultVariant: { id: second.id, title: second.title }, onVariantChange });

    expect(screen.getByRole('button', { name: second.title, pressed: true })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: BUILD.variants[2]!.title }));

    expect(onVariantChange).toHaveBeenCalledWith({ id: BUILD.variants[2]!.id, title: BUILD.variants[2]!.title });
  });
});

describe('BuildView tabs', () => {
  it('lists the tabs and opens the overview by default', () => {
    renderView();

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Overview', 'Skills', 'Gear', 'Passives', 'Atlas Tree', 'Progression', 'Comments']);
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
    expect(selectedTab()).toBe('Comments');
    expect(document.activeElement?.textContent).toBe('Comments');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Comments' }), { key: 'ArrowRight' });
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

    expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1', '-1', '-1', '-1']);
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

  it('shows the comments last, with the counter the site shows, and opens the discussion without a variant', () => {
    const comments = createCommentsController({
      seed: {
        status: 'ready',
        resourceId: resourceIdOf('doc-1'),
        authorId: AUTHOR_ID,
        sort: 'NEW',
        canSort: true,
        total: 24,
        list: parseCommentsPayload(commentsPayload({ comments: [rawComment({ id: 'r1', text: 'Budget ring?' })] }), AUTHOR_ID)!,
      },
      source: { roots: () => new Promise(() => {}), replies: () => new Promise(() => {}), post: () => new Promise(() => {}), vote: () => new Promise(() => {}) },
    });
    const { onRouteChange } = renderView('#gear', BUILD, false, undefined, { comments });

    const tab = screen.getAllByRole('tab').at(-1)!;
    expect(tab.textContent).toBe('Comments24');
    fireEvent.click(tab);

    expect(onRouteChange).toHaveBeenLastCalledWith('#comments');
    expect(screen.getByRole('tabpanel', { name: /Comments/ })).toBeTruthy();
    expect(screen.getByText('Budget ring?')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Build variant' })).toBeNull();
  });

  it('lets the comments run edge to edge, so their scrollbar sits at the right of the window', () => {
    renderView('#comments');

    expect(screen.getByRole('tabpanel').classList.contains('build-view__panel--flush')).toBe(true);
  });

  it('opens the comments from the hash and says they are unavailable without a discussion to read', () => {
    renderView('#comments');

    expect(selectedTab()).toBe('Comments');
    expect(screen.getByText('Comments are unavailable here')).toBeTruthy();
  });

  it('stops listening to number keys when unmounted', () => {
    const { unmount, onRouteChange } = renderView();
    unmount();

    fireEvent.keyDown(document, { key: '2' });

    expect(onRouteChange).not.toHaveBeenCalled();
  });
});

describe('BuildView comments panel', () => {
  /** A window wide enough for the panel unless a test narrows it. */
  let wide = true;
  const queries: { listener: (() => void) | null }[] = [];
  beforeEach(() => {
    wide = true;
    queries.length = 0;
    vi.stubGlobal('matchMedia', () => {
      const query = {
        listener: null as (() => void) | null,
        get matches() {
          return wide;
        },
        addEventListener: (_: string, listener: () => void) => (query.listener = listener),
        removeEventListener: () => (query.listener = null),
      };
      queries.push(query);
      return query;
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const narrow = () =>
    act(() => {
      wide = false;
      queries.forEach((query) => query.listener?.());
    });

  const discussion = () =>
    createCommentsController({
      seed: {
        status: 'ready',
        resourceId: resourceIdOf('doc-1'),
        authorId: AUTHOR_ID,
        sort: 'NEW',
        canSort: true,
        total: 24,
        list: parseCommentsPayload(commentsPayload({ comments: [rawComment({ id: 'r1', text: 'Budget ring?' })] }), AUTHOR_ID)!,
      },
      source: { roots: () => new Promise(() => {}), replies: () => new Promise(() => {}), post: () => new Promise(() => {}), vote: () => new Promise(() => {}) },
    });

  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Open comments panel' }));
  const aside = () => screen.queryByRole('complementary', { name: 'Comments' });

  it('opens the discussion beside Gear in place of Gear Priority, without leaving the tab', () => {
    const { onRouteChange } = renderView('#gear', BUILD, false, undefined, { comments: discussion() });
    expect(screen.getByRole('list', { name: 'Gear priority' })).toBeTruthy();

    open();

    expect(within(aside()!).getByText('Budget ring?')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Gear priority' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Equipment' })).toBeTruthy();
    expect(selectedTab()).toBe('Gear');
    expect(onRouteChange).not.toHaveBeenCalled();

    const toggle = screen.getByRole('button', { name: 'Close comments panel', expanded: true });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(aside()).toBeNull();
    expect(screen.getByRole('list', { name: 'Gear priority' })).toBeTruthy();
  });

  it('keeps the panel open across Overview and Skills, giving up their side columns but not the skill details', () => {
    renderView('#gear', BUILD, false, undefined, { comments: discussion() });
    open();

    fireEvent.click(screen.getByRole('tab', { name: 'Skills' }));
    expect(aside()).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Skill details' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(aside()).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'At a glance' })).toBeNull();
  });

  it('shows the counter and closes from its own header, handing focus back to the toggle', () => {
    renderView('#gear', BUILD, false, undefined, { comments: discussion() });
    open();

    expect(within(aside()!).getByRole('heading', { name: /Comments/ }).textContent).toContain('24');
    fireEvent.click(within(aside()!).getByRole('button', { name: 'Close comments panel' }));

    expect(aside()).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open comments panel' }));
  });

  it('closes on Escape from inside the panel', () => {
    renderView('#gear', BUILD, false, undefined, { comments: discussion() });
    open();

    fireEvent.keyDown(within(aside()!).getByRole('searchbox', { name: 'Search comments' }), { key: 'Escape' });

    expect(aside()).toBeNull();
  });

  it('expands into the Comments tab with a way back to the section, panel and all', () => {
    const { onRouteChange } = renderView('#gear', BUILD, false, undefined, { comments: discussion() });
    open();

    fireEvent.click(within(aside()!).getByRole('button', { name: 'Open in the Comments tab' }));

    expect(selectedTab()).toBe('Comments24');
    expect(onRouteChange).toHaveBeenLastCalledWith('#comments');
    expect(aside()).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Back to Gear' }));
    expect(selectedTab()).toBe('Gear');
    expect(aside()).toBeTruthy();
  });

  it('opens the Comments tab instead where the trees need the whole width', () => {
    renderView('#passives', BUILD, false, undefined, { comments: discussion() });

    fireEvent.click(screen.getByRole('button', { name: 'Open comments' }));

    expect(selectedTab()).toBe('Comments24');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Passives' }));
    expect(selectedTab()).toBe('Passives');
    expect(aside()).toBeNull();
  });

  it('offers no back button when the Comments tab was picked directly', () => {
    renderView('#gear', BUILD, false, undefined, { comments: discussion() });

    fireEvent.click(screen.getByRole('tab', { name: /Comments/ }));

    expect(screen.queryByRole('button', { name: /^Back to/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /comments panel/ })).toBeNull();
  });

  it('moves the discussion into the Comments tab when the window gets too narrow for it', () => {
    renderView('#gear', BUILD, false, undefined, { comments: discussion() });
    open();

    narrow();

    expect(selectedTab()).toBe('Comments24');
    expect(screen.getByRole('button', { name: 'Back to Gear' })).toBeTruthy();
  });

  it('opens the Comments tab from the toggle on a narrow window', () => {
    wide = false;
    renderView('#gear', BUILD, false, undefined, { comments: discussion() });

    fireEvent.click(screen.getByRole('button', { name: 'Open comments' }));

    expect(selectedTab()).toBe('Comments24');
    expect(aside()).toBeNull();
  });
});
