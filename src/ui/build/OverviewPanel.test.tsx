import { fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { Build } from '@/lib/build/model';
import { parseBuild } from '@/lib/build/parse-build';
import { TooltipProvider } from '@/ui/tooltip/Tooltip';
import { loadFixture, textNodes } from '../../../tests/fixtures/load';
import { OverviewPanel } from './OverviewPanel';

const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
const BUILD = parseBuild(fixture.build, fixture.staticData);

function renderPanel(build: Build = BUILD, glanceCollapsed?: boolean, onGlanceCollapsedChange = vi.fn()) {
  const view = render(
    <TooltipProvider>
      <OverviewPanel build={build} glanceCollapsed={glanceCollapsed} onGlanceCollapsedChange={onGlanceCollapsedChange} />
    </TooltipProvider>,
  );
  return { ...view, onGlanceCollapsedChange };
}

const glance = () => screen.getByRole('region', { name: 'At a glance' });

describe('OverviewPanel', () => {
  it('shows each guide text section under its title', () => {
    const { container } = renderPanel();

    const sections = container.querySelector('.overview__texts')!;
    expect([...sections.querySelectorAll('h2')].map((h) => h.textContent)).toEqual(['Build Overview', 'How it Plays']);
    expect(sections.textContent).toContain(textNodes(BUILD.sections[0]!.content)[0]);
  });

  it('lists strengths and weaknesses first in the glance card, not as cards of their own', () => {
    const { container } = renderPanel();

    const groups = [...glance().querySelectorAll('.glance__label')].map((el) => el.textContent);
    expect(groups.slice(0, 2)).toEqual(['Strengths', 'Weaknesses']);
    const strengths = textNodes(BUILD.strengths);
    expect(strengths).toHaveLength(3);
    expect([...glance().querySelectorAll('.glance__strengths li')].map((li) => li.textContent)).toEqual(strengths);
    expect([...glance().querySelectorAll('.glance__weaknesses li')].map((li) => li.textContent)).toEqual(textNodes(BUILD.weaknesses));
    expect(container.querySelector('.overview__texts .glance__strengths, .overview__texts .overview__strengths')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Strengths' })).toBeNull();
  });

  it('leaves out strengths and weaknesses the author did not write', () => {
    renderPanel({ ...BUILD, strengths: null, weaknesses: null });

    expect(glance().querySelector('.glance__strengths')).toBeNull();
    expect(glance().querySelector('.glance__weaknesses')).toBeNull();
  });

  it('sums up the finished build at a glance', () => {
    renderPanel();
    const card = within(glance());

    expect(card.getByText('Based on ENDGAME (LOW LIFE)')).toBeTruthy();
    expect(glance().querySelector('.glance__skill .glance__name')?.textContent).toBe('Essence Drain');
    expect([...glance().querySelectorAll('.glance__uniques .glance__name')].map((el) => el.textContent)).toEqual([
      "Atziri's Disdain",
      'Ingenuity',
      'Nascent Hope',
      'The Fall of the Axe',
    ]);
    expect([...glance().querySelectorAll('.glance__ascendancy .glance__name')].map((el) => el.textContent)).toEqual(['Soulless Form', 'Eternal Life', 'Eldritch Empowerment']);
    expect(card.getByText('DEADRABB1T')).toBeTruthy();
    expect(card.getByText('Sep 13, 2026')).toBeTruthy();
  });

  it('opens tooltips for what the glance card lists', () => {
    renderPanel();

    fireEvent.focus(glance().querySelector('.glance__uniques .tooltip-trigger')!);
    expect(screen.getByRole('tooltip').querySelector('.tooltip__title')?.textContent).toBe("Atziri's Disdain");

    fireEvent.focus(glance().querySelector('.glance__ascendancy .tooltip-trigger')!);
    expect(screen.getByRole('tooltip').querySelector('.tooltip__title')?.textContent).toBe('Soulless Form');
  });

  it('links the video guide in a new tab', () => {
    renderPanel();

    const link = within(glance()).getByRole('link', { name: 'Video guide on YouTube' });
    expect(link.getAttribute('href')).toBe(BUILD.videoUrl);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('skips a video link that is not a web address', () => {
    renderPanel({ ...BUILD, videoUrl: 'javascript:alert(1)' });

    expect(within(glance()).queryByRole('link')).toBeNull();
  });

  it('opens a tooltip for an entity mentioned in the text', () => {
    const { container } = renderPanel();

    const contagion = within(container.querySelector('.overview__texts') as HTMLElement).getAllByText('Contagion')[0]!.closest('.tooltip-trigger') as HTMLElement;
    fireEvent.focus(contagion);

    expect(screen.getByRole('tooltip').textContent).toContain('Skill Gem');
  });

  it('leaves entities without static data as plain chips', () => {
    const { container } = renderPanel({ ...BUILD, entities: {} });

    expect(container.querySelector('.overview__texts .rt-entity')).not.toBeNull();
    expect(container.querySelector('.overview__texts .tooltip-trigger')).toBeNull();
  });

  it('collapses At a Glance so the guide texts get the room', () => {
    const { onGlanceCollapsedChange } = renderPanel(BUILD, false);

    const toggle = within(glance()).getByRole('button', { name: 'Collapse At a Glance' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);

    expect(onGlanceCollapsedChange).toHaveBeenCalledWith(true);
  });

  it('shows a collapsed At a Glance as a slim rail that expands again', () => {
    const { container, onGlanceCollapsedChange } = renderPanel(BUILD, true);

    expect(container.querySelector('.overview')?.classList.contains('overview--glance-collapsed')).toBe(true);
    expect(glance().querySelector('.glance__group')).toBeNull();
    fireEvent.click(within(glance()).getByRole('button', { name: 'Expand At a Glance' }));

    expect(onGlanceCollapsedChange).toHaveBeenCalledWith(false);
  });

  it('toggles At a Glance by itself when nobody keeps the state', () => {
    render(
      <TooltipProvider>
        <OverviewPanel build={BUILD} />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Collapse At a Glance' }));

    expect(screen.getByRole('button', { name: 'Expand At a Glance' })).toBeTruthy();
  });

  it('explains when the guide has no texts', () => {
    renderPanel({ ...BUILD, sections: [] });

    expect(screen.getByText("The author hasn't added a build description.")).toBeTruthy();
  });
});
