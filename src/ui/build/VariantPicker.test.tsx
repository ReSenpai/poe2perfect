import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { Variant } from '@/lib/build/model';
import { VariantPicker } from './VariantPicker';

const VARIANTS = [
  { id: 'a', title: 'ACT 1' },
  { id: 'b', title: 'ENDGAME (FULL LIFE)' },
] as Variant[];

describe('VariantPicker', () => {
  it('marks the selected variant and switches on click', () => {
    const onChange = vi.fn();
    render(<VariantPicker variants={VARIANTS} selectedId="a" onChange={onChange} />);

    const group = screen.getByRole('group', { name: 'Build variant' });
    expect(group.textContent).toBe('ACT 1ENDGAME (FULL LIFE)');
    expect(screen.getByRole('button', { name: 'ACT 1' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'ENDGAME (FULL LIFE)' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'ENDGAME (FULL LIFE)' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('hides itself when there is nothing to choose', () => {
    const { container } = render(<VariantPicker variants={VARIANTS.slice(0, 1)} selectedId="a" onChange={vi.fn()} />);

    expect(container.innerHTML).toBe('');
  });
});
