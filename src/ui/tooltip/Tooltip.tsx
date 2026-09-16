import type { ComponentChildren } from 'preact';
import { createContext, render } from 'preact';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Placement, placeTooltip } from '@/lib/tooltip/placement';
import type { TooltipModel } from '@/lib/tooltip/tooltip-model';

const TOOLTIP_ID = 'guide-tooltip';
const HOVER_DELAY_MS = 150;

interface TooltipApi {
  open(anchor: HTMLElement, model: TooltipModel): void;
  close(anchor?: HTMLElement): void;
  openAnchor: HTMLElement | null;
}

const TooltipContext = createContext<TooltipApi | null>(null);

/** Hosts the single tooltip of the UI; triggers inside it open and close it. */
export function TooltipProvider({ children }: { children: ComponentChildren }) {
  const [open, setOpen] = useState<{ anchor: HTMLElement; model: TooltipModel } | null>(null);

  const api = useMemo<TooltipApi>(
    () => ({
      open: (anchor, model) => setOpen({ anchor, model }),
      close: (anchor) => setOpen((current) => (!anchor || current?.anchor === anchor ? null : current)),
      openAnchor: open?.anchor ?? null,
    }),
    [open],
  );

  useEffect(() => {
    if (!open) return;
    // The tooltip is positioned once, so any scroll would detach it from its trigger.
    const close = () => setOpen(null);
    document.addEventListener('scroll', close, true);
    return () => document.removeEventListener('scroll', close, true);
  }, [open]);

  return (
    <TooltipContext.Provider value={api}>
      {children}
      {open && <TooltipOutsideOverlay anchor={open.anchor} model={open.model} />}
    </TooltipContext.Provider>
  );
}

export function WithTooltip({ model, children }: { model: TooltipModel | null; children: ComponentChildren }) {
  const api = useContext(TooltipContext);
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!model || !api) return <>{children}</>;

  const show = () => ref.current && api.open(ref.current, model);
  const hide = () => {
    clearTimeout(timer.current);
    if (ref.current) api.close(ref.current);
  };
  const isOpen = api.openAnchor !== null && api.openAnchor === ref.current;

  return (
    <span
      ref={ref}
      class="tooltip-trigger"
      tabIndex={0}
      aria-describedby={isOpen ? TOOLTIP_ID : undefined}
      onPointerOver={(event) => {
        // pointerover bubbles from nested triggers (e.g. a rune inside an item card): only the innermost trigger
        // under the pointer shows its tooltip, and the outer one takes over again once the pointer is back on it.
        clearTimeout(timer.current);
        const owner = (event.target as Element).closest('.tooltip-trigger');
        if (owner === ref.current && api.openAnchor !== ref.current) timer.current = setTimeout(show, HOVER_DELAY_MS);
      }}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(event) => {
        if (event.key === 'Escape') hide();
      }}
    >
      {children}
    </span>
  );
}

/** Outside the overlay's stacking context: the site's passive tree is laid over the overlay and would cover it. */
function TooltipOutsideOverlay({ anchor, model }: { anchor: HTMLElement; model: TooltipModel }) {
  const layer = anchor.closest('.overlay')?.parentElement;
  const tooltip = <TooltipLayer anchor={anchor} model={model} />;
  return layer ? <Portal parent={layer}>{tooltip}</Portal> : tooltip;
}

function TooltipLayer({ anchor, model }: { anchor: HTMLElement; model: TooltipModel }) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setPlacement(
      placeTooltip({
        anchor: anchor.getBoundingClientRect(),
        size: { width: element.offsetWidth, height: element.offsetHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }),
    );
  }, [anchor, model]);

  return (
    <div
      ref={ref}
      id={TOOLTIP_ID}
      role="tooltip"
      class={`tooltip tooltip--${model.accent}`}
      style={placement ? { left: `${placement.left}px`, top: `${placement.top}px` } : { visibility: 'hidden' }}
    >
      <TooltipCard model={model} />
    </div>
  );
}

/** Renders into its own root at the end of `parent`. */
function Portal({ parent, children }: { parent: Element; children: ComponentChildren }) {
  const [host] = useState(() => parent.ownerDocument.createElement('div'));
  useLayoutEffect(() => {
    parent.append(host);
    return () => {
      render(null, host);
      host.remove();
    };
  }, [parent, host]);
  useLayoutEffect(() => {
    render(<>{children}</>, host);
  });
  return null;
}

function TooltipCard({ model }: { model: TooltipModel }) {
  return (
    <>
      <div class="tooltip__header">
        {model.iconUrl && <img class="tooltip__icon" src={model.iconUrl} alt="" />}
        <div>
          <p class="tooltip__title">{model.title}</p>
          {model.subtitle && <p class="tooltip__subtitle">{model.subtitle}</p>}
        </div>
      </div>
      {model.tags.length > 0 && (
        <ul class="tooltip__tags">
          {model.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
      {model.stats.length > 0 && (
        <dl class="tooltip__stats">
          {model.stats.map(({ name, value }) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {model.requirements && <p class="tooltip__requirements">Requires: {model.requirements}</p>}
      {model.description && <p class="tooltip__description">{model.description}</p>}
      {model.sections.map((section, i) => (
        <div key={i} class={`tooltip__section tooltip__section--${section.tone}`}>
          {section.title && <p class="tooltip__section-title">{section.title}</p>}
          <ul>
            {section.lines.map((line, j) => (
              <li key={j}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
      {model.flavour && <p class="tooltip__flavour">{model.flavour}</p>}
      {model.corrupted && <p class="tooltip__corrupted">Corrupted</p>}
      {model.note && <p class="tooltip__note">{model.note}</p>}
    </>
  );
}
