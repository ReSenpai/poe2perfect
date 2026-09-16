import { PanelRightClose, PanelRightOpen, PlayCircle } from 'lucide-preact';
import { useMemo, useState } from 'preact/hooks';
import type { Build } from '@/lib/build/model';
import { gemTooltip, itemTooltip, passiveTooltip } from '@/lib/tooltip/tooltip-model';
import { formatUpdated, keyUniques, showcaseVariant, videoHost } from '@/lib/ui/overview';
import { RichText } from '@/ui/rich-text/RichText';
import { entityChipRenderer } from '@/ui/tooltip/EntityTooltipChip';
import { WithTooltip } from '@/ui/tooltip/Tooltip';

type RenderEntity = ReturnType<typeof entityChipRenderer>;

/**
 * What the build is about: the guide texts, with a summary of the finished build beside them. The summary collapses
 * to a slim rail; pass `glanceCollapsed` to keep that state outside (it toggles by itself otherwise).
 */
export function OverviewPanel({
  build,
  glanceCollapsed,
  onGlanceCollapsedChange,
}: {
  build: Build;
  glanceCollapsed?: boolean;
  onGlanceCollapsedChange?: (collapsed: boolean) => void;
}) {
  const renderEntity = useMemo(() => entityChipRenderer(build.entities), [build.entities]);
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const collapsed = glanceCollapsed ?? localCollapsed;
  const setCollapsed = (next: boolean) => {
    setLocalCollapsed(next);
    onGlanceCollapsedChange?.(next);
  };

  return (
    <div class={collapsed ? 'overview overview--glance-collapsed' : 'overview'}>
      <div class="overview__texts">
        {build.sections.length === 0 ? (
          <p class="panel-empty">The author hasn't added a build description.</p>
        ) : (
          build.sections.map((text) => (
            <section key={text.id} class="card">
              <h2 class="card__title">{text.title}</h2>
              <RichText value={text.content} renderEntity={renderEntity} />
            </section>
          ))
        )}
      </div>
      {collapsed ? (
        <section class="card glance glance--collapsed" aria-label="At a glance">
          <GlanceToggle collapsed onToggle={() => setCollapsed(false)} />
          <span class="glance__rail-title" aria-hidden="true">
            At a Glance
          </span>
        </section>
      ) : (
        <AtAGlance build={build} renderEntity={renderEntity} onCollapse={() => setCollapsed(true)} />
      )}
    </div>
  );
}

function GlanceToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const label = collapsed ? 'Expand At a Glance' : 'Collapse At a Glance';
  return (
    <button type="button" class="icon-button glance__toggle" aria-label={label} title={label} aria-expanded={!collapsed} onClick={onToggle}>
      {collapsed ? <PanelRightOpen size={16} aria-hidden="true" /> : <PanelRightClose size={16} aria-hidden="true" />}
    </button>
  );
}

function AtAGlance({ build, renderEntity, onCollapse }: { build: Build; renderEntity: RenderEntity; onCollapse: () => void }) {
  const variant = showcaseVariant(build);
  const mainSkill = variant?.skills[0]?.gem;
  const uniques = variant ? keyUniques(variant) : [];
  const ascendancy = variant?.passives.ascendancy ?? [];
  const updated = formatUpdated(build.updatedAt);
  const host = build.videoUrl ? videoHost(build.videoUrl) : null;

  return (
    <section class="card glance" aria-label="At a glance">
      <div class="glance__header">
        <h2 class="card__title">At a Glance</h2>
        <GlanceToggle collapsed={false} onToggle={onCollapse} />
      </div>
      {variant && build.variants.length > 1 && <p class="glance__based">Based on {variant.title}</p>}

      {build.strengths && (
        <div class="glance__group glance__strengths">
          <p class="glance__label">Strengths</p>
          <RichText value={build.strengths} renderEntity={renderEntity} />
        </div>
      )}

      {build.weaknesses && (
        <div class="glance__group glance__weaknesses">
          <p class="glance__label">Weaknesses</p>
          <RichText value={build.weaknesses} renderEntity={renderEntity} />
        </div>
      )}

      {mainSkill && (
        <div class="glance__group glance__skill">
          <p class="glance__label">Main Skill</p>
          <WithTooltip model={gemTooltip(mainSkill)}>
            <span class="glance__entry">
              {mainSkill.iconUrl && <img class="glance__icon" src={mainSkill.iconUrl} alt="" />}
              <span class="glance__name">{mainSkill.name}</span>
            </span>
          </WithTooltip>
        </div>
      )}

      {uniques.length > 0 && (
        <div class="glance__group glance__uniques">
          <p class="glance__label">Key Uniques</p>
          <ul class="glance__list">
            {uniques.map(({ item, socketables }) => (
              <li key={item.slug}>
                <WithTooltip model={itemTooltip(item, socketables)}>
                  <span class="glance__entry">
                    {item.iconUrl && <img class="glance__icon" src={item.iconUrl} alt="" />}
                    <span class="glance__name item-name--unique">{item.name}</span>
                  </span>
                </WithTooltip>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ascendancy.length > 0 && (
        <div class="glance__group glance__ascendancy">
          <p class="glance__label">Ascendancy{build.ascendancy ? ` · ${build.ascendancy}` : ''}</p>
          <ul class="glance__list">
            {ascendancy.map((passive) => (
              <li key={passive.nodeSlug ?? passive.name}>
                <WithTooltip model={passiveTooltip(passive)}>
                  <span class="glance__entry">
                    {passive.iconUrl && <img class="glance__icon glance__icon--round" src={passive.iconUrl} alt="" />}
                    <span class="glance__name">{passive.name}</span>
                  </span>
                </WithTooltip>
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl class="glance__meta">
        {build.author && (
          <div>
            <dt>Author</dt>
            <dd>{build.author}</dd>
          </div>
        )}
        {updated && (
          <div>
            <dt>Updated</dt>
            <dd>{updated}</dd>
          </div>
        )}
      </dl>

      {build.videoUrl && host && (
        <a class="glance__video" href={build.videoUrl} target="_blank" rel="noopener noreferrer" aria-label={`Video guide on ${host}`}>
          <PlayCircle size={16} aria-hidden="true" />
          <span>Video guide</span>
          <span class="glance__video-host">{host}</span>
        </a>
      )}
    </section>
  );
}
