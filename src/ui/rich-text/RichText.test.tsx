import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import type { RichText as RichTextValue } from '@/lib/build/model';
import { RichText } from './RichText';

const doc = (...children: unknown[]): RichTextValue => ({ root: { type: 'root', children } });
const paragraph = (...children: unknown[]) => ({ type: 'paragraph', children });
const text = (value: string, format = 0, style = '') => ({ type: 'text', text: value, format, style });
const chip = { type: 'static-data-widget', id: 'contagionplayer', label: 'Contagion', groupId: 'activeSkillGems', icon: 'https://cdn.mobalytics.gg/Contagion.avif' };

function renderValue(value: RichTextValue | null, props: Partial<Parameters<typeof RichText>[0]> = {}) {
  return render(<RichText value={value} {...props} />).container;
}

describe('RichText', () => {
  it('renders nothing without a value', () => {
    expect(renderValue(null).innerHTML).toBe('');
  });

  it('renders paragraphs and headings', () => {
    const container = renderValue(doc({ type: 'heading', tag: 'h3', children: [text('Leveling')] }, paragraph(text('Use Contagion.'))));

    expect(screen.getByRole('heading', { level: 3, name: 'Leveling' })).toBeTruthy();
    expect(container.querySelector('p')?.textContent).toBe('Use Contagion.');
  });

  it('applies text formats and hex colours', () => {
    const container = renderValue(doc(paragraph(text('bold', 1), text('both', 3), text('under', 8), text('gold', 0, 'color: #ffdc7b;'))));

    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('strong em, em strong')?.textContent).toBe('both');
    expect(container.querySelector('u')?.textContent).toBe('under');
    expect((container.querySelector('span[style]') as HTMLElement).style.color).toBe('#ffdc7b');
  });

  it('renders lists with their start number and nesting', () => {
    const container = renderValue(
      doc({
        type: 'list',
        listType: 'number',
        start: 2,
        children: [
          { type: 'listitem', children: [text('Wand')] },
          { type: 'listitem', children: [text('Focus'), { type: 'list', listType: 'bullet', children: [{ type: 'listitem', children: [text('Rune')] }] }] },
        ],
      }),
    );

    const ol = container.querySelector('ol');
    expect(ol?.getAttribute('start')).toBe('2');
    expect([...ol!.children].map((li) => li.firstChild?.textContent)).toEqual(['Wand', 'Focus']);
    expect(container.querySelector('ol li ul li')?.textContent).toBe('Rune');
  });

  it('renders a bullet list without a start attribute', () => {
    const container = renderValue(doc({ type: 'list', listType: 'bullet', start: 1, children: [{ type: 'listitem', children: [text('a')] }] }));

    expect(container.querySelector('ul')?.hasAttribute('start')).toBe(false);
  });

  it('opens links in a new tab without leaking the opener', () => {
    renderValue(doc(paragraph({ type: 'link', url: '/poe-2/guides/poison', children: [text('Poison guide')] })));

    const link = screen.getByRole('link', { name: 'Poison guide' });
    expect(link.getAttribute('href')).toBe('https://mobalytics.gg/poe-2/guides/poison');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders line breaks', () => {
    const container = renderValue(doc(paragraph(text('a'), { type: 'linebreak' }, text('b'))));

    expect(container.querySelector('p')?.innerHTML).toBe('a<br>b');
  });

  it('renders entity chips with icon and label', () => {
    const container = renderValue(doc(paragraph(text('Spread with '), chip)));

    const entity = container.querySelector('.rt-entity');
    expect(entity?.classList.contains('rt-entity--skill')).toBe(true);
    expect(entity?.getAttribute('data-slug')).toBe('contagionplayer');
    expect(entity?.querySelector('img')?.getAttribute('src')).toBe('https://cdn.mobalytics.gg/Contagion.avif');
    expect(entity?.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(entity?.textContent).toBe('Contagion');
  });

  it('hides an entity icon that fails to load, keeping the label', () => {
    const container = renderValue(doc(paragraph(chip)));
    const img = container.querySelector('.rt-entity img') as HTMLImageElement;

    fireEvent.error(img);

    expect(img.hidden).toBe(true);
    expect(container.querySelector('.rt-entity')?.textContent).toBe('Contagion');
  });

  it('lets the caller render entities, e.g. with a tooltip', () => {
    renderValue(doc(paragraph(chip)), { renderEntity: (entity) => <button type="button">{`${entity.group}:${entity.label}`}</button> });

    expect(screen.getByRole('button', { name: 'skill:Contagion' })).toBeTruthy();
  });

  it('never turns text into markup', () => {
    const container = renderValue(doc(paragraph(text('<img src=x onerror="alert(1)"><script>alert(2)</script>'))));

    expect(container.querySelector('img, script')).toBeNull();
    expect(container.textContent).toBe('<img src=x onerror="alert(1)"><script>alert(2)</script>');
  });
});
