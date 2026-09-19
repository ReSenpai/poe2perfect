import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Attributes, EntityInfo, Gem, GemPriorityEntry, Skill, Variant } from '@/lib/build/model';
import { gemAttribute, gemTooltip } from '@/lib/tooltip/tooltip-model';
import { copyText } from '@/lib/ui/clipboard';
import { RichText } from '@/ui/rich-text/RichText';
import { entityChipRenderer } from '@/ui/tooltip/EntityTooltipChip';
import { WithTooltip } from '@/ui/tooltip/Tooltip';

const EMPTY = "The author hasn't listed skills for this variant.";

/** Active skills of a variant with their supports, and details of the selected skill. */
export function SkillsPanel({
  variant,
  entities,
  copy = copyText,
}: {
  variant: Variant;
  entities: Record<string, EntityInfo>;
  /** Injected in tests; a gem name goes to the clipboard, ready for the game's own search. */
  copy?: (text: string) => Promise<boolean>;
}) {
  const renderEntity = useMemo(() => entityChipRenderer(entities), [entities]);
  const { notice, copyName } = useCopyName(copy);
  const [selected, setSelected] = useState(0);
  // Which gem the gem priority points at, so Active Skills can mark it.
  const [pointedAt, setPointedAt] = useState<GemPointer | null>(null);
  const skill = variant.skills[selected] ?? variant.skills[0];

  if (!skill && !variant.skillNotes) {
    return <p class="panel-empty">{EMPTY}</p>;
  }

  return (
    <div class="skills">
      {skill ? (
        <div class="skills__columns">
          <div class="skills__main">
            <section class="card skills__list">
              <div class="skills__heading">
                <h2 class="card__title">Active Skills</h2>
                {variant.gemRequirements && <span class="skills__requirements">{formatAttributes(variant.gemRequirements)}</span>}
              </div>
              <ul class="skill-rows" aria-label="Active skills">
                {variant.skills.map((entry, i) => (
                  <SkillRow
                    key={`${entry.gem.slug}-${i}`}
                    skill={entry}
                    selected={entry === skill}
                    onSelect={() => setSelected(i)}
                    onCopy={copyName}
                    pointedAt={pointedAt}
                  />
                ))}
              </ul>
            </section>
            {variant.gemPriority.length > 0 && (
              <GemPriorityCard entries={variant.gemPriority} currentSkillSlug={skill.gem.slug} onPointAt={setPointedAt} onCopy={copyName} />
            )}
          </div>
          <SkillDetails skill={skill} onCopy={copyName} />
        </div>
      ) : (
        <p class="panel-empty">{EMPTY}</p>
      )}
      {notice && (
        <p class="skills__copied" role="status">
          {notice}
        </p>
      )}
      {variant.skillNotes && (
        <section class="card skills__notes">
          <h2 class="card__title">Author's Notes</h2>
          <RichText value={variant.skillNotes} renderEntity={renderEntity} />
        </section>
      )}
    </div>
  );
}

/** Copies a gem name and says so for a moment, so the click has a visible answer. */
function useCopyName(copy: (text: string) => Promise<boolean>) {
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copyName = async (name: string) => {
    const copied = await copy(name);
    setNotice(copied ? `Copied \u201c${name}\u201d` : "Couldn't copy the name");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 2000);
  };

  return { notice, copyName };
}

const copyLabel = (name: string) => `Copy \u201c${name}\u201d`;

/** A gem the gem priority points at: a support inside its skill, or an active skill on its own. */
export interface GemPointer {
  gemSlug: string;
  parentSlug: string | null;
}

function SkillRow({
  skill,
  selected,
  onSelect,
  onCopy,
  pointedAt,
}: {
  skill: Skill;
  selected: boolean;
  onSelect: () => void;
  onCopy: (name: string) => void;
  pointedAt: GemPointer | null;
}) {
  const { gem, supports } = skill;
  const matchesSkill = pointedAt !== null && pointedAt.parentSlug === null && pointedAt.gemSlug === gem.slug;
  const matchesSupport = (support: Gem) => pointedAt !== null && pointedAt.parentSlug === gem.slug && pointedAt.gemSlug === support.slug;
  return (
    <li class={`skill-row${selected ? ' skill-row--selected' : ''}${matchesSkill ? ' skill-row--match' : ''}`}>
      <button
        type="button"
        class="skill-row__main"
        aria-pressed={selected}
        title="Show details and copy the gem name"
        onClick={() => {
          onSelect();
          void onCopy(gem.name);
        }}
      >
        <GemIcon gem={gem} class="skill-row__icon" />
        <span class="skill-row__text">
          <span class="skill-row__name">{gem.name}</span>
          {gem.details && gem.details.tags.length > 0 && <span class="skill-row__tags">{gem.details.tags.join(' · ')}</span>}
        </span>
      </button>
      {supports.length > 0 && (
        <span class="skill-row__supports">
          {supports.map((support, i) => (
            <WithTooltip key={`${support.slug}-${i}`} model={gemTooltip(support)}>
              <button type="button" class="gem-copy" aria-label={copyLabel(support.name)} onClick={() => onCopy(support.name)}>
                <GemIcon
                  gem={support}
                  class={`skill-row__support gem-socket gem-socket--${gemAttribute(support) ?? 'none'}${matchesSupport(support) ? ' skill-row__support--match' : ''}`}
                />
              </button>
            </WithTooltip>
          ))}
        </span>
      )}
    </li>
  );
}

function GemPriorityCard({
  entries,
  currentSkillSlug,
  onPointAt,
  onCopy,
}: {
  entries: GemPriorityEntry[];
  currentSkillSlug: string;
  onPointAt: (pointer: GemPointer | null) => void;
  onCopy: (name: string) => void;
}) {
  return (
    <section class="card gem-priority">
      <h2 class="card__title">Gem Priority</h2>
      <ol class="gem-priority__list" aria-label="Gem priority">
        {entries.map((entry, i) => (
          <li
            key={`${entry.gem.slug}-${i}`}
            class={entry.parentSlug === currentSkillSlug ? 'gem-priority__row gem-priority__row--current' : 'gem-priority__row'}
            onPointerEnter={() => onPointAt({ gemSlug: entry.gem.slug, parentSlug: entry.parentSlug })}
            onPointerLeave={() => onPointAt(null)}
            onFocusIn={() => onPointAt({ gemSlug: entry.gem.slug, parentSlug: entry.parentSlug })}
            onFocusOut={() => onPointAt(null)}
          >
            <span class="gem-priority__number">{i + 1}</span>
            <WithTooltip model={gemTooltip(entry.gem)}>
              <button type="button" class="gem-priority__gem gem-copy" aria-label={copyLabel(entry.gem.name)} onClick={() => onCopy(entry.gem.name)}>
                <GemIcon gem={entry.gem} class={`gem-priority__icon gem-socket gem-socket--${gemAttribute(entry.gem) ?? 'none'}`} />
                <span class="gem-priority__text">
                  <span class="gem-priority__name">{entry.gem.name}</span>
                  {entry.parentName && (
                    <span class="gem-priority__parent" title={entry.parentName}>
                      {entry.parentName}
                    </span>
                  )}
                </span>
              </button>
            </WithTooltip>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SkillDetails({ skill, onCopy }: { skill: Skill; onCopy: (name: string) => void }) {
  const { gem, supports } = skill;
  const details = gem.details;
  return (
    <section class="card skill-details" aria-label="Skill details">
      <div class="skill-details__header">
        <button type="button" class="gem-copy" aria-label={copyLabel(gem.name)} onClick={() => onCopy(gem.name)}>
          <GemIcon gem={gem} class="skill-details__icon" />
        </button>
        <div>
          <h2 class="skill-details__name">{gem.name}</h2>
          {details && details.tags.length > 0 && (
            <ul class="skill-details__tags">
              {details.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {!details && <p class="panel-empty">No details available for this gem.</p>}
      {details && details.stats.length > 0 && (
        <dl class="skill-details__stats">
          {details.stats.map(({ name, value }) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {details && details.requirements.length > 0 && (
        <p class="skill-details__requirements">Requires: {details.requirements.map(({ name, value }) => `${name} ${value}`).join(', ')}</p>
      )}
      {details?.description && <p class="skill-details__description">{details.description}</p>}
      {details && details.effects.length > 0 && (
        <ul class="skill-details__effects">
          {details.effects.flatMap((effect) => effect.split('\n')).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      {details && details.qualityEffects.length > 0 && (
        <div class="skill-details__quality">
          <p class="skill-details__section-title">Additional Effects From Quality</p>
          <ul>
            {details.qualityEffects.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {supports.length > 0 && (
        <div class="skill-details__supports">
          <p class="skill-details__section-title">Support Gems</p>
          <ul>
            {supports.map((support, i) => (
              <li key={`${support.slug}-${i}`}>
                <WithTooltip key={`${support.slug}-${i}`} model={gemTooltip(support)}>
                  <button type="button" class="skill-details__support gem-copy" aria-label={copyLabel(support.name)} onClick={() => onCopy(support.name)}>
                    <GemIcon gem={support} class={`skill-details__support-icon gem-socket gem-socket--${gemAttribute(support) ?? 'none'}`} />
                    <span class="skill-details__support-name">{support.name}</span>
                  </button>
                </WithTooltip>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function GemIcon({ gem, class: className }: { gem: Gem; class: string }) {
  return gem.iconUrl ? <img class={className} src={gem.iconUrl} alt="" /> : <span class={`${className} gem-icon--missing`} />;
}

function formatAttributes({ str, dex, int }: Attributes): string {
  return `Str ${str} · Dex ${dex} · Int ${int}`;
}
