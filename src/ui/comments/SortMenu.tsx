import { Check, ChevronDown } from 'lucide-preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { CommentsSort } from '@/lib/comments/model';

const OPTIONS: { value: CommentsSort; label: string }[] = [
  { value: 'NEW', label: 'Newest' },
  { value: 'OLD', label: 'Oldest' },
  { value: 'TOP', label: 'Top' },
];

/**
 * The comment order as a small menu drawn in the guide's own style (a native select opens the system's list).
 * Listbox pattern: arrows move, Enter or Space picks, Escape closes and returns to the button, a click outside closes.
 */
export function SortMenu({ value, onChange }: { value: CommentsSort; onChange: (sort: CommentsSort) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const optionId = (index: number) => `${baseId}-sort-${index}`;
  const current = Math.max(0, OPTIONS.findIndex((option) => option.value === value));

  const show = () => {
    setActive(current);
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const pick = (index: number) => {
    const option = OPTIONS[index]!;
    close(true);
    if (option.value !== value) onChange(option.value);
  };

  useEffect(() => {
    if (!open) return undefined;
    list.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (root.current && !event.composedPath().includes(root.current)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const onButtonKey = (event: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      show();
    }
  };

  const onListKey = (event: KeyboardEvent) => {
    const last = OPTIONS.length - 1;
    const moves: Record<string, () => number> = {
      ArrowDown: () => Math.min(active + 1, last),
      ArrowUp: () => Math.max(active - 1, 0),
      Home: () => 0,
      End: () => last,
    };
    if (moves[event.key]) {
      event.preventDefault();
      setActive(moves[event.key]!());
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pick(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  const label = OPTIONS[current]!.label;
  return (
    <div class="sort-menu" ref={root}>
      <button
        ref={button}
        type="button"
        class="sort-menu__button"
        aria-label={`Sort comments: ${label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={onButtonKey}
      >
        {label}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <ul
          ref={list}
          class="sort-menu__list"
          role="listbox"
          aria-label="Sort comments"
          tabIndex={-1}
          aria-activedescendant={optionId(active)}
          onKeyDown={onListKey}
        >
          {OPTIONS.map((option, index) => (
            <li
              key={option.value}
              id={optionId(index)}
              class={index === active ? 'sort-menu__option sort-menu__option--active' : 'sort-menu__option'}
              role="option"
              aria-selected={index === current}
              onClick={() => pick(index)}
              onPointerMove={() => setActive(index)}
            >
              <span>{option.label}</span>
              {index === current && <Check size={14} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
