import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { EntityInfo, Passive, Variant } from '@/lib/build/model';
import type { TreeKind } from '@/lib/passives/site-tree';
import { embedSiteTree, type TreeEmbed, type TreeEmbedStatus } from '@/lib/passives/tree-embed';
import { passiveTooltip } from '@/lib/tooltip/tooltip-model';
import { RichText } from '@/ui/rich-text/RichText';
import { entityChipRenderer } from '@/ui/tooltip/EntityTooltipChip';
import { WithTooltip } from '@/ui/tooltip/Tooltip';

export type EmbedTree = (options: {
  kind: TreeKind;
  placeholder: HTMLElement;
  variantIndex: number;
  onStatus: (status: TreeEmbedStatus) => void;
}) => TreeEmbed;

const embedIntoPage: EmbedTree = (options) => embedSiteTree({ doc: document, win: window, ...options });

const TREE_NAMES: Record<TreeKind, string> = { 'passive-tree': 'passive tree', 'atlas-tree': 'atlas tree' };

const statusText = (status: Exclude<TreeEmbedStatus, 'ready'>, kind: TreeKind) =>
  status === 'loading' ? `Loading the ${TREE_NAMES[kind]}…` : `The site didn't show a ${TREE_NAMES[kind]} for this build.`;

/** The site's passive tree for the variant, with the author's key passives (and notes on the tree) beside it. */
export function PassivesPanel({
  variant,
  variantIndex,
  entities,
  embedTree = embedIntoPage,
}: {
  variant: Variant;
  variantIndex: number;
  entities: Record<string, EntityInfo>;
  embedTree?: EmbedTree;
}) {
  const { passives, passiveNotes } = variant;
  const renderEntity = useMemo(() => entityChipRenderer(entities), [entities]);
  // The author's notes on the tree usually matter most, so they open first.
  const [side, setSide] = useState<SideView>('notes');
  const showNotes = side === 'notes' && passiveNotes !== null;
  const points = [`${passives.nodeCount} points`, passives.ascendancyNodeCount > 0 ? `${passives.ascendancyNodeCount} ascendancy` : null].filter(Boolean).join(' · ');

  return (
    <div class="passives">
      <SiteTree kind="passive-tree" variantIndex={variantIndex} embedTree={embedTree} />
      <aside class="card passives__side">
        <div class="passives__heading">
          {passiveNotes ? (
            <SideTabs label="Passives side panel" idPrefix="passives-side" keysText="Passives" keysLabel="Key passives" view={side} onSelect={setSide} />
          ) : (
            <h2 class="card__title">Key Passives</h2>
          )}
          {!showNotes && <span class="passives__points">{points}</span>}
        </div>
        <div class="passives__lists" {...(passiveNotes ? { role: 'tabpanel', 'aria-labelledby': showNotes ? 'passives-side-notes' : 'passives-side-keys' } : {})}>
          {showNotes ? (
            <RichText value={passiveNotes} renderEntity={renderEntity} class="passives__notes" />
          ) : (
            <>
              {passives.ascendancy.length > 0 && (
                <div class="passives__group">
                  <p class="passives__label">Ascendancy</p>
                  <PassiveRows passives={passives.ascendancy} label="Ascendancy passives" />
                </div>
              )}
              <div class="passives__group">
                {passives.ascendancy.length > 0 && <p class="passives__label">Passive Tree</p>}
                {passives.keyPassives.length > 0 ? (
                  <PassiveRows passives={passives.keyPassives} label="Key passives" numbered />
                ) : (
                  <p class="passives__empty">The author hasn't picked key passives for this variant.</p>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

export type SideView = 'notes' | 'keys';

/** Switches a side panel between the author's notes and the key nodes; notes come first. */
export function SideTabs({
  label,
  idPrefix,
  keysText,
  keysLabel,
  view,
  onSelect,
}: {
  label: string;
  idPrefix: string;
  keysText: string;
  keysLabel: string;
  view: SideView;
  onSelect: (view: SideView) => void;
}) {
  return (
    <div class="side-tabs" role="tablist" aria-label={label}>
      <SideTab id={`${idPrefix}-notes`} label="Author's notes" selected={view === 'notes'} onSelect={() => onSelect('notes')}>
        Notes
      </SideTab>
      <SideTab id={`${idPrefix}-keys`} label={keysLabel} selected={view === 'keys'} onSelect={() => onSelect('keys')}>
        {keysText}
      </SideTab>
    </div>
  );
}

/** A short label on screen; `label` names it apart from the main tabs (there's a "Passives" tab already). */
function SideTab({ id, label, selected, onSelect, children }: { id: string; label: string; selected: boolean; onSelect: () => void; children: string }) {
  return (
    <button type="button" role="tab" id={id} class="side-tabs__tab" aria-label={label} aria-selected={selected} tabIndex={selected ? 0 : -1} onClick={onSelect}>
      {children}
    </button>
  );
}

/** Placeholder the site's tree is laid over, with the status until the tree is shown. */
export function SiteTree({ kind, variantIndex, embedTree }: { kind: TreeKind; variantIndex: number; embedTree: EmbedTree }) {
  const stage = useRef<HTMLDivElement>(null);
  const embed = useRef<TreeEmbed | null>(null);
  const shownIndex = useRef(variantIndex);
  const [status, setStatus] = useState<TreeEmbedStatus>('loading');

  useEffect(() => {
    const placeholder = stage.current!;
    const handle = embedTree({ kind, placeholder, variantIndex: shownIndex.current, onStatus: setStatus });
    embed.current = handle;
    // The tree is laid over the placeholder with fixed positioning, so it has to follow the panel's scrolling.
    const scroller = placeholder.closest('.build-view__panel');
    const follow = () => handle.sync();
    scroller?.addEventListener('scroll', follow);
    return () => {
      scroller?.removeEventListener('scroll', follow);
      handle.destroy();
      embed.current = null;
    };
  }, [embedTree, kind]);

  // Another variant switches the tree the site already shows.
  useEffect(() => {
    if (shownIndex.current === variantIndex) return;
    shownIndex.current = variantIndex;
    embed.current?.setVariant(variantIndex);
  }, [variantIndex]);

  return (
    <section class="card passives__tree" aria-label={TREE_NAMES[kind].replace(/^./, (first) => first.toUpperCase())}>
      <div class="passives__stage" ref={stage}>
        {status !== 'ready' && (
          <p class="passives__status" role="status">
            {statusText(status, kind)}
          </p>
        )}
      </div>
    </section>
  );
}

export function PassiveRows({ passives, label, numbered = false }: { passives: Passive[]; label: string; numbered?: boolean }) {
  return (
    <ol class="passive-rows" aria-label={label}>
      {passives.map((passive, i) => (
        <li key={passive.nodeSlug ?? `${passive.name}-${i}`} class={`passive-row passive-row--${passive.kind}`}>
          <WithTooltip model={passiveTooltip(passive)}>
            <span class="passive-row__body">
              {numbered && <span class="passive-row__number">{i + 1}</span>}
              {passive.iconUrl ? <img class="passive-row__icon" src={passive.iconUrl} alt="" /> : <span class="passive-row__icon" />}
              <span class="passive-row__text">
                <span class="passive-row__name">{passive.name}</span>
                {passive.effects[0] && <span class="passive-row__effect">{passive.effects[0]}</span>}
              </span>
            </span>
          </WithTooltip>
        </li>
      ))}
    </ol>
  );
}
