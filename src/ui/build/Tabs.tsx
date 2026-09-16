import { FlaskConical, Info, type LucideIcon, MapIcon, Network, Shirt, Sparkles } from 'lucide-preact';
import { useRef } from 'preact/hooks';
import { TABS, type TabId } from '@/lib/ui/route';

type Tab = (typeof TABS)[number];

const ICONS: Record<TabId, LucideIcon> = {
  overview: Info,
  skills: Sparkles,
  gear: Shirt,
  passives: Network,
  atlas: MapIcon,
  progression: FlaskConical,
};

export const tabElementId = (tab: TabId) => `tab-${tab}`;
export const panelElementId = (tab: TabId) => `panel-${tab}`;

/** WAI-ARIA tabs: one tab stop, arrow keys move the selection. */
export function Tabs({ tabs = TABS, selected, onSelect }: { tabs?: readonly Tab[]; selected: TabId; onSelect: (tab: TabId) => void }) {
  const refs = useRef(new Map<TabId, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent) => {
    const index = tabs.findIndex((tab) => tab.id === selected);
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length]!.id;
    onSelect(next);
    refs.current.get(next)?.focus();
  };

  return (
    <div class="tabs" role="tablist" aria-label="Build sections">
      {tabs.map(({ id, label }) => {
        const Icon = ICONS[id];
        const isSelected = id === selected;
        return (
          <button
            key={id}
            ref={(element) => {
              if (element) refs.current.set(id, element);
            }}
            type="button"
            role="tab"
            id={tabElementId(id)}
            class="tabs__tab"
            aria-selected={isSelected}
            aria-controls={panelElementId(id)}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(id)}
            onKeyDown={onKeyDown}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
