import { useMemo, useState } from 'preact/hooks';
import type { EntityInfo, Variant } from '@/lib/build/model';
import { embedSiteTree } from '@/lib/passives/tree-embed';
import { RichText } from '@/ui/rich-text/RichText';
import { entityChipRenderer } from '@/ui/tooltip/EntityTooltipChip';
import type { TreeFocus } from '@/lib/passives/tree-focus';
import { type EmbedTree, PassiveRows, SideTabs, type SideView, SiteTree, useTreeFocus } from './PassivesPanel';

const embedIntoPage: EmbedTree = (options) => embedSiteTree({ doc: document, win: window, ...options });

/** The site's atlas tree for the variant, with the author's notes and the atlas notables and keystones taken. */
export function AtlasPanel({
  variant,
  variantIndex,
  entities = {},
  embedTree = embedIntoPage,
  treeFocus,
}: {
  variant: Variant;
  variantIndex: number;
  entities?: Record<string, EntityInfo>;
  embedTree?: EmbedTree;
  treeFocus?: TreeFocus;
}) {
  const { atlas, atlasNotes } = variant;
  const focus = useTreeFocus('atlas-tree', treeFocus);
  const renderEntity = useMemo(() => entityChipRenderer(entities), [entities]);
  const [side, setSide] = useState<SideView>('keys');
  const showNotes = side === 'notes' && atlasNotes !== null;

  return (
    <div class="passives">
      {atlas ? (
        <SiteTree kind="atlas-tree" variantIndex={variantIndex} embedTree={embedTree} />
      ) : (
        // The site has no atlas widget for a variant without an atlas tree, so there's nothing to embed.
        <section class="card passives__tree" aria-label="Atlas tree">
          <div class="passives__stage">
            <p class="passives__status" role="status">
              The site shows no atlas tree for this variant.
            </p>
          </div>
        </section>
      )}
      <aside class="card passives__side">
        <div class="passives__heading">
          {atlasNotes ? (
            <SideTabs label="Atlas side panel" idPrefix="atlas-side" keysText="Atlas" keysLabel="Key atlas passives" view={side} onSelect={setSide} />
          ) : (
            <h2 class="card__title">Key Atlas Passives</h2>
          )}
          {atlas && !showNotes && <span class="passives__points">{atlas.pointCount} points</span>}
        </div>
        <div
          class="passives__lists"
          {...(atlasNotes ? { role: 'tabpanel', 'aria-labelledby': showNotes ? 'atlas-side-notes' : 'atlas-side-keys' } : {})}
        >
          {showNotes ? (
            <RichText value={atlasNotes} renderEntity={renderEntity} class="passives__notes" />
          ) : !atlas || atlas.groups.length === 0 ? (
            <p class="passives__empty">
              {atlas ? "The author hasn't taken atlas notables in this variant." : "The author hasn't suggested atlas passives for this variant yet."}
            </p>
          ) : (
            atlas.groups.map((group) => (
              <div key={group.id} class="passives__group">
                <p class="passives__label">{group.label}</p>
                <PassiveRows passives={group.passives} label={`${group.label} passives`} focus={focus} />
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
